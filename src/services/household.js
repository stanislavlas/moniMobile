/**
 * Household Service
 * -----------------
 * A household lets multiple users share one pool of entries.
 * Only the owner can add/remove members.
 * All members (owner included) see all entries in the household.
 *
 * The server derives householdId from the JWT for all operations —
 * no householdId is needed in request URLs or bodies except for
 * removeMember which requires a specific memberId.
 *
 * Offline-first:
 * - All mutating operations queue failed requests on network errors AND server errors (5xx).
 * - sync* exports are used by syncService to replay queued ops.
 */

import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";
import { isRetryableError } from "../utils/isRetryableError.js";

logger.info('household', 'Household service loaded');

async function enqueueHouseholdOp(type, payload) {
  try {
    const { default: syncService } = await import("./syncService.js");
    const { getStoredUser } = await import("./auth.js");
    const user = await getStoredUser();
    await syncService.enqueue(type, payload, user?.userId);
  } catch (err) {
    logger.error('household', `Failed to queue ${type}`, err.message);
    throw err;
  }
}

async function isOffline() {
  const { default: syncService } = await import("./syncService.js");
  return !syncService.isOnline();
}

/** Get the current user's household (null if not in one) */
export async function getMyHousehold() {
  logger.info('household', 'getMyHousehold called');
  try {
    const result = await authRequest("/api/households");
    logger.info('household', 'getMyHousehold result: ' + (result ? 'household found' : 'no household'));
    return result;
  } catch (error) {
    logger.error('household', 'getMyHousehold error', error.message);
    throw error;
  }
}

/** Create a new household. The caller becomes owner. */
export async function createHousehold(name, { skipQueue = false } = {}) {
  logger.info('household', 'createHousehold called', { name });
  if (!skipQueue && await isOffline()) {
    await enqueueHouseholdOp("household.create", { name });
    return { queued: true };
  }
  try {
    const result = await authRequest("/api/households", {
      method: "POST",
      body: JSON.stringify({ name }),
    }, skipQueue ? 0 : 3000);
    logger.info('household', 'createHousehold success');
    return result;
  } catch (error) {
    logger.error('household', 'createHousehold error', error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueHouseholdOp("household.create", { name });
      return { queued: true };
    }
    throw error;
  }
}

/** Owner: add a member by email */
export async function addMember(email, { skipQueue = false } = {}) {
  logger.info('household', 'addMember called', { email });
  if (!skipQueue && await isOffline()) {
    await enqueueHouseholdOp("household.addMember", { email });
    return { queued: true };
  }
  try {
    const result = await authRequest("/api/households/members", {
      method: "POST",
      body: JSON.stringify({ email }),
    }, skipQueue ? 0 : 3000);
    logger.info('household', 'addMember success');
    return result;
  } catch (error) {
    logger.error('household', 'addMember error', error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueHouseholdOp("household.addMember", { email });
      return { queued: true };
    }
    throw error;
  }
}

/** Owner: remove a member by userId */
export async function removeMember(memberId, { skipQueue = false } = {}) {
  logger.info('household', 'removeMember called', { memberId });
  if (!skipQueue && await isOffline()) {
    await enqueueHouseholdOp("household.removeMember", { memberId });
    return { queued: true };
  }
  try {
    const result = await authRequest(`/api/households/members/${memberId}`, { method: "DELETE" }, skipQueue ? 0 : 3000);
    logger.info('household', 'removeMember success');
    return result;
  } catch (error) {
    logger.error('household', 'removeMember error', error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueHouseholdOp("household.removeMember", { memberId });
      return { queued: true };
    }
    throw error;
  }
}

/** Any member: leave the household */
export async function leaveHousehold({ skipQueue = false } = {}) {
  logger.info('household', 'leaveHousehold called');
  if (!skipQueue && await isOffline()) {
    await enqueueHouseholdOp("household.leave", {});
    return { queued: true };
  }
  try {
    const result = await authRequest("/api/households/leave", { method: "POST" }, skipQueue ? 0 : 3000);
    logger.info('household', 'leaveHousehold success');
    return result;
  } catch (error) {
    logger.error('household', 'leaveHousehold error', error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueHouseholdOp("household.leave", {});
      return { queued: true };
    }
    throw error;
  }
}

/** Owner: delete the entire household */
export async function deleteHousehold({ skipQueue = false } = {}) {
  logger.info('household', 'deleteHousehold called');
  if (!skipQueue && await isOffline()) {
    await enqueueHouseholdOp("household.delete", {});
    return { queued: true };
  }
  try {
    const result = await authRequest("/api/households", { method: "DELETE" }, skipQueue ? 0 : 3000);
    logger.info('household', 'deleteHousehold success');
    return result;
  } catch (error) {
    logger.error('household', 'deleteHousehold error', error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueHouseholdOp("household.delete", {});
      return { queued: true };
    }
    throw error;
  }
}

/** Owner: rename the household */
export async function renameHousehold(name, { skipQueue = false } = {}) {
  logger.info('household', 'renameHousehold called', { name });
  if (!skipQueue && await isOffline()) {
    await enqueueHouseholdOp("household.rename", { name });
    return { queued: true };
  }
  try {
    const result = await authRequest("/api/households", {
      method: "PUT",
      body: JSON.stringify({ name }),
    }, skipQueue ? 0 : 3000);
    logger.info('household', 'renameHousehold success');
    return result;
  } catch (error) {
    logger.error('household', 'renameHousehold error', error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueHouseholdOp("household.rename", { name });
      return { queued: true };
    }
    throw error;
  }
}

// ── Sync-replay functions (used by syncService, skipQueue=true) ───────────────

export async function syncCreateHousehold(name) {
  return createHousehold(name, { skipQueue: true });
}

export async function syncAddMember(email) {
  return addMember(email, { skipQueue: true });
}

export async function syncRemoveMember(memberId) {
  return removeMember(memberId, { skipQueue: true });
}

export async function syncLeaveHousehold() {
  return leaveHousehold({ skipQueue: true });
}

export async function syncDeleteHousehold() {
  return deleteHousehold({ skipQueue: true });
}

export async function syncRenameHousehold(name) {
  return renameHousehold(name, { skipQueue: true });
}
