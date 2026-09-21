/**
 * Custom Categories Service
 * -------------------------
 * Users can create their own categories on top of the built-in ones.
 * Custom categories are stored in `budget_categories` DynamoDB table:
 *
 *   PK: userId     (String)
 *   SK: categoryId (String) — "custom:<timestamp>-<random>"
 *   Attributes: label, emoji, type ("income"|"expense"), createdAt
 *
 * The Lambda routes are:
 *   GET    /categories        → list user's custom categories
 *   POST   /categories        → create a new custom category
 *   DELETE /categories/:id    → delete a custom category
 *
 * Offline-first:
 * - createCustomCategory and deleteCustomCategory queue failed requests on network errors AND server errors (5xx).
 * - deleteCustomCategory blocks deletion if the category is referenced by a pending queue entry.
 * - syncCreateCategory / syncDeleteCategory are used by syncService to replay queued ops.
 */

import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";
import { isRetryableError } from "../utils/isRetryableError.js";

logger.info('categories', 'Categories service loaded');

export async function listCustomCategories() {
  logger.info('categories', 'listCustomCategories called');
  try {
    const result = await authRequest("/api/categories");
    logger.info('categories', 'listCustomCategories success: ' + (result?.length || 0) + ' categories');
    return result;
  } catch (error) {
    logger.error('categories', 'listCustomCategories error', error.message);
    throw error;
  }
}

export async function createCustomCategory({ label, emoji, type, color = "#7F77DD" }, { skipQueue = false } = {}) {
  logger.info('categories', 'createCustomCategory called', { label, emoji, type });

  if (!skipQueue) {
    const { default: syncService } = await import("./syncService.js");
    if (!syncService.isOnline()) {
      logger.info('categories', 'createCustomCategory: offline, queuing directly');
      const { getStoredUser } = await import("./auth.js");
      const user = await getStoredUser();
      await syncService.enqueue("category.create", { label, emoji, type, color }, user?.userId);
      return { queued: true };
    }
  }

  try {
    const result = await authRequest("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: label, emoji, type: type.toUpperCase(), color }),
    }, skipQueue ? 0 : 3000);
    logger.info('categories', 'createCustomCategory success');
    return result;
  } catch (error) {
    logger.error('categories', 'createCustomCategory error', error.message);

    if (!skipQueue && isRetryableError(error)) {
      try {
        const { default: syncService } = await import("./syncService.js");
        const { getStoredUser } = await import("./auth.js");
        const user = await getStoredUser();
        await syncService.enqueue("category.create", { label, emoji, type, color }, user?.userId);
        logger.info('categories', 'createCustomCategory queued for background sync');
        return { queued: true };
      } catch (queueErr) {
        logger.error('categories', 'Failed to queue createCustomCategory', queueErr.message);
      }
    }

    throw error;
  }
}

export async function deleteCustomCategory(categoryId, { skipQueue = false } = {}) {
  logger.info('categories', 'deleteCustomCategory called: ' + categoryId);

  if (!skipQueue) {
    const { default: syncService } = await import("./syncService.js");
    if (!syncService.isOnline()) {
      logger.info('categories', 'deleteCustomCategory: offline, queuing directly');
      const { loadQueue } = await import("../utils/queueStorage.js");
      const queue = await loadQueue();
      const hasEntriesWithCategory = queue.operations.some(op =>
        op.type?.startsWith('entry.') && op.payload?.categoryId === categoryId
      );
      if (hasEntriesWithCategory) {
        throw new Error(
          'Cannot delete category while entries using it are pending sync. ' +
          'Please wait for sync to complete or change those entries first.'
        );
      }
      const { getStoredUser } = await import("./auth.js");
      const user = await getStoredUser();
      await syncService.enqueue("category.delete", { categoryId }, user?.userId);
      return { queued: true };
    }
  }

  try {
    const result = await authRequest(`/api/categories/${categoryId}`, { method: "DELETE" }, skipQueue ? 0 : 3000);
    logger.info('categories', 'deleteCustomCategory success');
    return result;
  } catch (error) {
    logger.error('categories', 'deleteCustomCategory error', error.message);

    if (!skipQueue && isRetryableError(error)) {
      try {
        const { loadQueue } = await import("../utils/queueStorage.js");
        const queue = await loadQueue();
        const hasEntriesWithCategory = queue.operations.some(op =>
          op.type?.startsWith('entry.') && op.payload?.categoryId === categoryId
        );
        if (hasEntriesWithCategory) {
          throw new Error(
            'Cannot delete category while entries using it are pending sync. ' +
            'Please wait for sync to complete or change those entries first.'
          );
        }
        const { default: syncService } = await import("./syncService.js");
        const { getStoredUser } = await import("./auth.js");
        const user = await getStoredUser();
        await syncService.enqueue("category.delete", { categoryId }, user?.userId);
        logger.info('categories', 'deleteCustomCategory queued for background sync');
        return { queued: true };
      } catch (queueErr) {
        if (queueErr.message?.includes('Cannot delete')) throw queueErr;
        logger.error('categories', 'Failed to queue deleteCustomCategory', queueErr.message);
      }
    }

    throw error;
  }
}

/** Used by syncService to replay a queued category.create */
export async function syncCreateCategory(payload) {
  return createCustomCategory(payload, { skipQueue: true });
}

/** Used by syncService to replay a queued category.delete */
export async function syncDeleteCategory(categoryId) {
  return deleteCustomCategory(categoryId, { skipQueue: true });
}
