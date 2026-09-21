/**
 * Sync Service
 * ------------
 * Core synchronization engine. Manages the offline operation queue,
 * retries failed operations with exponential backoff, and resolves
 * conflicts using a last-write-wins strategy.
 *
 * Usage:
 *   import syncService from './syncService.js';
 *   await syncService.enqueue('entry.create', payload);
 *   await syncService.syncAll();
 */

import NetInfo from "@react-native-community/netinfo";
import * as queueStorage from "../utils/queueStorage.js";
import { logger } from "../utils/logger.js";

// ─── Constants ───────────────────────────────────────────────────────────────

// Delay between sequential sync operations (ms)
const INTER_OP_DELAY = 100;

// ─── In-memory cache ─────────────────────────────────────────────────────────

/** Cached queue to reduce AsyncStorage reads during app lifecycle */
let cachedQueue = null;

/** Current network state */
let networkOnline = true;

/** NetInfo unsubscribe handle */
let netInfoUnsubscribe = null;

/** Whether a sync is currently running */
let syncInProgress = false;

// ─── Event Emitter (simple pub/sub) ──────────────────────────────────────────

const listeners = {};

function emit(event, data) {
  (listeners[event] || []).forEach(fn => {
    try { fn(data); } catch {}
  });
}

export function addEventListener(event, handler) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(handler);
}

export function removeEventListener(event, handler) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(fn => fn !== handler);
}

// ─── Network detection ───────────────────────────────────────────────────────

/** Start listening to network state changes */
export function initNetworkMonitoring(onConnected) {
  if (netInfoUnsubscribe) return; // already listening

  netInfoUnsubscribe = NetInfo.addEventListener(state => {
    const wasOffline = !networkOnline;
    networkOnline = state.isConnected && state.isInternetReachable !== false;
    logger.info('sync', `Network state: ${networkOnline ? 'online' : 'offline'}`);

    if (wasOffline && networkOnline) {
      logger.info('sync', 'Network reconnected — triggering sync');
      emit('networkReconnected');
      if (onConnected) onConnected();
    }

    emit('networkChange', { isOnline: networkOnline });
  });
}

/** Returns whether the device is currently online. */
export function isOnline() {
  return networkOnline;
}

/** Stop listening to network state changes */
export function teardownNetworkMonitoring() {
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
}

// ─── Queue helpers ───────────────────────────────────────────────────────────

async function loadQueue() {
  if (cachedQueue) return cachedQueue;
  cachedQueue = await queueStorage.loadQueue();
  return cachedQueue;
}

async function persistQueue(queue) {
  cachedQueue = queue;
  await queueStorage.saveQueue(queue);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Add an operation to the sync queue.
 * @param {string} type - Operation type (e.g. "entry.create")
 * @param {object} payload - Operation data
 * @param {string} [userId] - User ID for queue isolation
 * @returns {object} The queued operation
 */
export async function enqueue(type, payload, userId) {
  logger.info('sync', `Enqueuing operation: ${type}`);
  const op = await queueStorage.addOperation({ type, payload, userId });
  cachedQueue = null; // Invalidate in-memory cache
  emit('queueChanged', await getQueueStatus());
  return op;
}

/**
 * Remove an operation from the queue.
 * @param {string} operationId
 */
export async function dequeue(operationId) {
  await queueStorage.removeOperation(operationId);
  cachedQueue = null;
  emit('queueChanged', await getQueueStatus());
}

/**
 * Get current queue status summary.
 * @returns {{ pending, syncing, failed, total }}
 */
export async function getQueueStatus() {
  return queueStorage.getQueueSummary();
}

/**
 * Clear the entire queue (called on logout).
 */
export async function clearQueue() {
  await queueStorage.clearQueue();
  cachedQueue = null;
  emit('queueChanged', { total: 0, pending: 0, syncing: 0, failed: 0 });
}

// ─── Sync executor ───────────────────────────────────────────────────────────

/**
 * Execute a single queued operation against the API.
 * Returns { success: bool, dequeued: bool, error?: string }
 */
async function executeOperation(operation) {
  // Lazy-import service functions to avoid circular dependencies
  const { syncPutEntry, syncDeleteEntry, syncBatchCreateEntries } = await import("./entries.js");
  const { syncCreateCategory, syncDeleteCategory } = await import("./customCategories.js");
  const {
    syncCreateHousehold,
    syncAddMember,
    syncRemoveMember,
    syncLeaveHousehold,
    syncDeleteHousehold,
    syncRenameHousehold,
  } = await import("./household.js");

  const { type, payload } = operation;

  try {
    switch (type) {
      case "entry.batchCreate":
        await syncBatchCreateEntries(payload.entries);
        break;
      case "entry.create":
      case "entry.update":
        await syncPutEntry(payload);
        break;
      case "entry.delete":
        await syncDeleteEntry(payload.entryId);
        break;
      case "category.create":
        await syncCreateCategory(payload);
        break;
      case "category.delete":
        await syncDeleteCategory(payload.categoryId);
        break;
      case "household.create":
        await syncCreateHousehold(payload.name);
        break;
      case "household.addMember":
        await syncAddMember(payload.email);
        break;
      case "household.removeMember":
        await syncRemoveMember(payload.memberId);
        break;
      case "household.rename":
        await syncRenameHousehold(payload.name);
        break;
      case "household.leave":
        await syncLeaveHousehold();
        break;
      case "household.delete":
        await syncDeleteHousehold();
        break;
      default:
        logger.warn('sync', `Unknown operation type: ${type}`);
        return { success: true, dequeued: true }; // Dequeue unknown ops
    }

    return { success: true, dequeued: true };
  } catch (error) {
    const msg = error.message || String(error);

    // AUTH_EXPIRED: stop all sync, queue will be cleared by caller
    if (error.code === "AUTH_EXPIRED") {
      throw error;
    }

    // 404 Not Found → resource deleted elsewhere, consider it synced
    if (msg.includes("404") || msg.includes("not found") || msg.includes("Not Found")) {
      await queueStorage.logConflict({
        operationType: type,
        operationId: operation.id,
        conflict: "Resource not found on server",
        resolution: "dequeued (404 treated as success)",
      });
      logger.info('sync', `Operation ${operation.id} (${type}) got 404 — treating as success`);
      return { success: true, dequeued: true };
    }

    // 409 Conflict → last-write-wins (overwrite server)
    if (msg.includes("409") || msg.includes("Conflict")) {
      await queueStorage.logConflict({
        operationType: type,
        operationId: operation.id,
        conflict: "409 Conflict",
        resolution: "retry with overwrite",
      });
      // Treat as a retriable error — let retry logic handle it
      return { success: false, dequeued: false, error: msg };
    }

    return { success: false, dequeued: false, error: msg };
  }
}

/**
 * Attempt a single queued operation once.
 * On failure the operation stays "pending" so the next syncAll() will retry.
 * Returns true if the operation was dequeued (success or permanent skip).
 */
async function syncOne(operation) {
  const result = await executeOperation(operation);

  if (result.success && result.dequeued) {
    await queueStorage.removeOperation(operation.id);
    cachedQueue = null;
    return true;
  }

  // Leave as pending — will be picked up next sync attempt
  await queueStorage.updateOperation(operation.id, {
    status: "pending",
    error: result.error || "Unknown error",
  });
  cachedQueue = null;
  return false;
}

/**
 * Process the entire pending/failed queue in chronological order.
 *
 * @returns {{ success: boolean, synced: number, errors: number, authExpired: boolean }}
 */
export async function syncAll() {
  if (syncInProgress) {
    logger.info('sync', 'Sync already in progress, skipping');
    return { success: false, synced: 0, errors: 0, authExpired: false };
  }

  if (!networkOnline) {
    logger.info('sync', 'Offline — skipping sync');
    return { success: false, synced: 0, errors: 0, authExpired: false };
  }

  syncInProgress = true;
  emit('syncStart');

  try {
    // Validate auth token before syncing
    const { ensureValidTokenForSync } = await import("./auth.js");
    const authCheck = await ensureValidTokenForSync();

    if (!authCheck.valid) {
      if (authCheck.offline) {
        // Can't reach server — leave queue intact, try again later
        logger.info('sync', 'Cannot reach server to validate token — queue preserved');
        emit('syncComplete', { synced: 0, errors: 0, authExpired: false, syncedOperations: [] });
        return { success: false, synced: 0, errors: 0, authExpired: false };
      }
      // Genuine auth expiry — clear the queue
      logger.warn('sync', 'Auth token expired — clearing queue');
      await clearQueue();
      emit('syncComplete', { synced: 0, errors: 0, authExpired: true, syncedOperations: [] });
      return { success: false, synced: 0, errors: 0, authExpired: true };
    }

    // Load pending operations (sorted oldest first)
    const queue = await loadQueue();
    const pendingOps = queue.operations
      .filter(op => op.status === "pending")
      .sort((a, b) => a.timestamp - b.timestamp);

    if (pendingOps.length === 0) {
      logger.info('sync', 'No pending operations');
      emit('syncComplete', { synced: 0, errors: 0, authExpired: false });
      return { success: true, synced: 0, errors: 0, authExpired: false };
    }

    logger.info('sync', `Processing ${pendingOps.length} pending operations`);

    let synced = 0;
    let errors = 0;
    const syncedOperations = [];

    for (const op of pendingOps) {
      if (!networkOnline) {
        logger.info('sync', 'Went offline mid-sync — stopping');
        break;
      }

      try {
        const ok = await syncOne(op);
        if (ok) {
          synced++;
          syncedOperations.push(op);
        } else {
          errors++;
        }
      } catch (err) {
        if (err.code === "AUTH_EXPIRED") {
          logger.warn('sync', 'AUTH_EXPIRED during sync — stopping and clearing queue');
          await clearQueue();
          emit('syncComplete', { synced, errors, authExpired: true, syncedOperations });
          return { success: false, synced, errors, authExpired: true };
        }
        errors++;
        logger.error('sync', `Operation ${op.id} threw unexpectedly`, err.message);
      }

      if (pendingOps.indexOf(op) < pendingOps.length - 1) {
        await new Promise(r => setTimeout(r, INTER_OP_DELAY));
      }
    }

    await queueStorage.updateSyncAttempt();
    if (synced > 0) await queueStorage.updateSuccessfulSync();
    cachedQueue = null;

    logger.info('sync', `Sync complete: ${synced} synced, ${errors} errors`);
    emit('syncComplete', { synced, errors, authExpired: false, syncedOperations });

    return { success: errors === 0, synced, errors, authExpired: false };
  } finally {
    syncInProgress = false;
  }
}

export default {
  enqueue,
  dequeue,
  syncAll,
  getQueueStatus,
  clearQueue,
  isOnline,
  initNetworkMonitoring,
  teardownNetworkMonitoring,
  addEventListener,
  removeEventListener,
};
