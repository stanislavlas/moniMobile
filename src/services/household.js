/**
 * Household Service
 * -----------------
 * A household lets multiple users share one pool of entries.
 * Only the owner can add/remove members.
 * All members (owner included) see all entries in the household.
 *
 * Offline-first:
 * - All mutating operations queue failed requests on network errors AND server errors (5xx).
 * - sync* exports are used by syncService to replay queued ops.
 */

import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";
import { isRetryableError } from "../utils/isRetryableError.js";
import { enqueueAndSync } from "../utils/enqueueAndSync.js";

async function isOffline() {
  const { default: syncService } = await import("./syncService.js");
  return !syncService.isOnline();
}

/**
 * Shared helper for offline-first mutating household operations.
 * Checks offline state → makes request → falls back to queue on retryable error.
 */
async function withOfflineQueue(opType, payload, requestFn, skipQueue) {
  if (!skipQueue && await isOffline()) {
    await enqueueAndSync(opType, payload);
    return { queued: true };
  }
  try {
    return await requestFn();
  } catch (error) {
    logger.error('household', `${opType} error`, error.message);
    if (!skipQueue && isRetryableError(error)) {
      await enqueueAndSync(opType, payload);
      return { queued: true };
    }
    throw error;
  }
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
  return withOfflineQueue(
    "household.create", { name },
    () => authRequest("/api/households", { method: "POST", body: JSON.stringify({ name }) }, skipQueue ? 0 : 3000),
    skipQueue,
  );
}

/** Owner: remove a member by userId */
export async function removeMember(memberId, { skipQueue = false } = {}) {
  logger.info('household', 'removeMember called', { memberId });
  return withOfflineQueue(
    "household.removeMember", { memberId },
    () => authRequest(`/api/households/members/${memberId}`, { method: "DELETE" }, skipQueue ? 0 : 3000),
    skipQueue,
  );
}

/** Any member: leave the household */
export async function leaveHousehold({ skipQueue = false } = {}) {
  logger.info('household', 'leaveHousehold called');
  return withOfflineQueue(
    "household.leave", {},
    () => authRequest("/api/households/leave", { method: "POST" }, skipQueue ? 0 : 3000),
    skipQueue,
  );
}

/** Owner: delete the entire household */
export async function deleteHousehold({ skipQueue = false } = {}) {
  logger.info('household', 'deleteHousehold called');
  return withOfflineQueue(
    "household.delete", {},
    () => authRequest("/api/households", { method: "DELETE" }, skipQueue ? 0 : 3000),
    skipQueue,
  );
}

/** Owner: rename the household */
export async function renameHousehold(name, { skipQueue = false } = {}) {
  logger.info('household', 'renameHousehold called', { name });
  return withOfflineQueue(
    "household.rename", { name },
    () => authRequest("/api/households", { method: "PUT", body: JSON.stringify({ name }) }, skipQueue ? 0 : 3000),
    skipQueue,
  );
}

/** Owner: send an invitation to an email address */
export async function sendInvitation(email, { skipQueue = false } = {}) {
  logger.info('household', 'sendInvitation called', { email });
  return withOfflineQueue(
    "household.sendInvitation", { email },
    () => authRequest("/api/households/invitations", { method: "POST", body: JSON.stringify({ email }) }, skipQueue ? 0 : 3000),
    skipQueue,
  );
}

// ── Sync-replay functions (used by syncService, skipQueue=true) ───────────────

export async function syncCreateHousehold(name)    { return createHousehold(name, { skipQueue: true }); }
export async function syncRemoveMember(memberId)   { return removeMember(memberId, { skipQueue: true }); }
export async function syncLeaveHousehold()         { return leaveHousehold({ skipQueue: true }); }
export async function syncDeleteHousehold()        { return deleteHousehold({ skipQueue: true }); }
export async function syncRenameHousehold(name)    { return renameHousehold(name, { skipQueue: true }); }
export async function syncSendInvitation(email)    { return sendInvitation(email, { skipQueue: true }); }

/** Invitee: get pending invitations for the current user */
export async function getPendingInvitations() {
  logger.info('household', 'getPendingInvitations called');
  try {
    const result = await authRequest("/api/households/invitations");
    return result ?? [];
  } catch (error) {
    logger.error('household', 'getPendingInvitations error', error.message);
    throw error;
  }
}

/** Owner: get invitations sent from my household */
export async function getSentInvitations() {
  logger.info('household', 'getSentInvitations called');
  try {
    return (await authRequest("/api/households/invitations/sent")) ?? [];
  } catch (error) {
    logger.error('household', 'getSentInvitations error', error.message);
    throw error;
  }
}

/** Invitee: accept an invitation */
export async function acceptInvitation(invitationId) {
  logger.info('household', 'acceptInvitation called', { invitationId });
  try {
    return await authRequest(`/api/households/invitations/${invitationId}/accept`, { method: "POST" });
  } catch (error) {
    logger.error('household', 'acceptInvitation error', error.message);
    throw error;
  }
}

/** Invitee: reject an invitation */
export async function rejectInvitation(invitationId) {
  logger.info('household', 'rejectInvitation called', { invitationId });
  try {
    return await authRequest(`/api/households/invitations/${invitationId}/reject`, { method: "POST" });
  } catch (error) {
    logger.error('household', 'rejectInvitation error', error.message);
    throw error;
  }
}

/** Owner: cancel a pending invitation */
export async function cancelInvitation(invitationId) {
  logger.info('household', 'cancelInvitation called', { invitationId });
  try {
    return await authRequest(`/api/households/invitations/${invitationId}`, { method: "DELETE" });
  } catch (error) {
    logger.error('household', 'cancelInvitation error', error.message);
    throw error;
  }
}
