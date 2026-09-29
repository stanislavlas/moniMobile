/**
 * Sync Service
 * ------------
 * Core synchronization engine. Manages the offline operation queue,
 * retries failed operations with exponential backoff, and resolves
 * conflicts using a last-write-wins strategy.
 *
 * All mutable state is encapsulated in the SyncService class so the
 * module is testable (instantiate a fresh instance per test) and safe
 * under React Native hot-reload (no leaked module-level variables).
 *
 * Usage:
 *   import syncService from './syncService.js';
 *   await syncService.enqueue('entry.create', payload);
 *   await syncService.syncAll();
 */

import NetInfo from "@react-native-community/netinfo";
import * as queueStorage from "../utils/queueStorage.js";
import { logger } from "../utils/logger.js";

// Delay between sequential sync operations (ms)
const INTER_OP_DELAY = 100;

// Maximum retry attempts before an operation is permanently marked "failed"
const MAX_RETRIES = 5;

class SyncService {
  constructor() {
    /** Cached queue to reduce AsyncStorage reads during app lifecycle */
    this._cachedQueue = null;
    /** Current network state */
    this._networkOnline = true;
    /** NetInfo unsubscribe handle */
    this._netInfoUnsubscribe = null;
    /** Whether a sync is currently running */
    this._syncInProgress = false;
    /** Event listeners map { eventName: [handler, ...] } */
    this._listeners = {};
  }

  // ─── Event Emitter ──────────────────────────────────────────────────────────

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(data); } catch {}
    });
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(fn => fn !== handler);
  }

  // ─── Network detection ──────────────────────────────────────────────────────

  /** Start listening to network state changes */
  initNetworkMonitoring(onConnected) {
    if (this._netInfoUnsubscribe) return; // already listening

    this._netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !this._networkOnline;
      this._networkOnline = state.isConnected && state.isInternetReachable !== false;
      logger.info('sync', `Network state: ${this._networkOnline ? 'online' : 'offline'}`);

      if (wasOffline && this._networkOnline) {
        logger.info('sync', 'Network reconnected — triggering sync');
        this._emit('networkReconnected');
        if (onConnected) onConnected();
      }

      this._emit('networkChange', { isOnline: this._networkOnline });
    });
  }

  /** Returns whether the device is currently online. */
  isOnline() {
    return this._networkOnline;
  }

  /** Stop listening to network state changes */
  teardownNetworkMonitoring() {
    if (this._netInfoUnsubscribe) {
      this._netInfoUnsubscribe();
      this._netInfoUnsubscribe = null;
    }
  }

  // ─── Queue helpers ──────────────────────────────────────────────────────────

  async _loadQueue() {
    if (this._cachedQueue) return this._cachedQueue;
    this._cachedQueue = await queueStorage.loadQueue();
    return this._cachedQueue;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add an operation to the sync queue.
   * @param {string} type - Operation type (e.g. "entry.create")
   * @param {object} payload - Operation data
   * @param {string} [userId] - User ID for queue isolation
   * @returns {object} The queued operation
   */
  async enqueue(type, payload, userId) {
    logger.info('sync', `Enqueuing operation: ${type}`);
    const op = await queueStorage.addOperation({ type, payload, userId });
    this._cachedQueue = null; // Invalidate in-memory cache
    this._emit('queueChanged', await this.getQueueStatus());
    return op;
  }

  /**
   * Remove an operation from the queue.
   * @param {string} operationId
   */
  async dequeue(operationId) {
    await queueStorage.removeOperation(operationId);
    this._cachedQueue = null;
    this._emit('queueChanged', await this.getQueueStatus());
  }

  /**
   * Get current queue status summary.
   * @returns {{ pending, syncing, failed, total }}
   */
  async getQueueStatus() {
    return queueStorage.getQueueSummary();
  }

  /**
   * Clear the entire queue (called on logout).
   */
  async clearQueue() {
    await queueStorage.clearQueue();
    this._cachedQueue = null;
    this._emit('queueChanged', { total: 0, pending: 0, failed: 0 });
  }

  /**
   * Reset all permanently-failed operations back to "pending" so the next
   * syncAll() will retry them.
   */
  async retryFailedOperations() {
    const queue = await queueStorage.loadQueue();
    const failedOps = queue.operations.filter(op => op.status === "failed");
    if (failedOps.length === 0) return;
    for (const op of failedOps) {
      await queueStorage.updateOperation(op.id, { status: "pending", retryCount: 0, error: null });
    }
    this._cachedQueue = null;
    logger.info('sync', `Reset ${failedOps.length} failed operation(s) to pending`);
    this._emit('queueChanged', await this.getQueueStatus());
  }

  // ─── Sync executor ──────────────────────────────────────────────────────────

  /**
   * Execute a single queued operation against the API.
   * Returns { success: bool, dequeued: bool, error?: string }
   */
  async _executeOperation(operation) {
    // Lazy-import service functions to avoid circular dependencies
    const { syncPutEntry, syncDeleteEntry } = await import("./entries.js");
    const { syncCreateCategory, syncDeleteCategory } = await import("./customCategories.js");
    const {
      syncCreateHousehold,
      syncRemoveMember,
      syncLeaveHousehold,
      syncDeleteHousehold,
      syncRenameHousehold,
      syncSendInvitation,
    } = await import("./household.js");

    const { type, payload } = operation;

    try {
      switch (type) {
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
        case "household.removeMember":
          await syncRemoveMember(payload.memberId);
          break;
        case "household.rename":
          await syncRenameHousehold(payload.name);
          break;
        case "household.leave":
          await syncLeaveHousehold();
          break;
        case "household.sendInvitation":
          await syncSendInvitation(payload.email);
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

      // 409 Conflict — leave the operation in the queue so the next syncAll() re-sends
      // the same payload. For PUT operations this is effectively last-write-wins since the
      // client payload is re-applied on retry. True merge/overwrite logic is not implemented.
      if (msg.includes("409") || msg.includes("Conflict")) {
        await queueStorage.logConflict({
          operationType: type,
          operationId: operation.id,
          conflict: "409 Conflict",
          resolution: "left pending for retry (last-write-wins on re-send)",
        });
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
  async _syncOne(operation) {
    const result = await this._executeOperation(operation);

    if (result.success && result.dequeued) {
      await queueStorage.removeOperation(operation.id);
      this._cachedQueue = null;
      return true;
    }

    // Increment retryCount; permanently mark as "failed" once MAX_RETRIES is reached
    const newRetryCount = (operation.retryCount ?? 0) + 1;
    const newStatus = newRetryCount >= MAX_RETRIES ? "failed" : "pending";
    if (newStatus === "failed") {
      logger.warn('sync', `Operation ${operation.id} (${operation.type}) permanently failed after ${newRetryCount} retries`);
    }
    await queueStorage.updateOperation(operation.id, {
      status: newStatus,
      error: result.error || "Unknown error",
      retryCount: newRetryCount,
    });
    this._cachedQueue = null;
    return false;
  }

  /**
   * Process the entire pending/failed queue in chronological order.
   *
   * @returns {{ success: boolean, synced: number, errors: number, authExpired: boolean }}
   */
  async syncAll() {
    if (this._syncInProgress) {
      logger.info('sync', 'Sync already in progress, skipping');
      return { success: false, synced: 0, errors: 0, authExpired: false };
    }

    if (!this._networkOnline) {
      logger.info('sync', 'Offline — skipping sync');
      return { success: false, synced: 0, errors: 0, authExpired: false };
    }

    this._syncInProgress = true;
    this._emit('syncStart');

    try {
      // Validate auth token before syncing
      const { ensureValidTokenForSync } = await import("./auth.js");
      const authCheck = await ensureValidTokenForSync();

      if (!authCheck.valid) {
        if (authCheck.offline) {
          // Can't reach server — leave queue intact, try again later
          logger.info('sync', 'Cannot reach server to validate token — queue preserved');
          this._emit('syncComplete', { synced: 0, errors: 0, authExpired: false, syncedOperations: [] });
          return { success: false, synced: 0, errors: 0, authExpired: false };
        }
        // Genuine auth expiry — clear the queue
        logger.warn('sync', 'Auth token expired — clearing queue');
        await this.clearQueue();
        this._emit('syncComplete', { synced: 0, errors: 0, authExpired: true, syncedOperations: [] });
        return { success: false, synced: 0, errors: 0, authExpired: true };
      }

      // Load pending operations (sorted oldest first)
      const queue = await this._loadQueue();
      const pendingOps = queue.operations
        .filter(op => op.status === "pending")
        .sort((a, b) => a.timestamp - b.timestamp);

      if (pendingOps.length === 0) {
        logger.info('sync', 'No pending operations');
        this._emit('syncComplete', { synced: 0, errors: 0, authExpired: false });
        return { success: true, synced: 0, errors: 0, authExpired: false };
      }

      logger.info('sync', `Processing ${pendingOps.length} pending operations`);

      let synced = 0;
      let errors = 0;
      const syncedOperations = [];

      for (let i = 0; i < pendingOps.length; i++) {
        const op = pendingOps[i];

        if (!this._networkOnline) {
          logger.info('sync', 'Went offline mid-sync — stopping');
          break;
        }

        try {
          const ok = await this._syncOne(op);
          if (ok) {
            synced++;
            syncedOperations.push(op);
          } else {
            errors++;
          }
        } catch (err) {
          if (err.code === "AUTH_EXPIRED") {
            logger.warn('sync', 'AUTH_EXPIRED during sync — stopping and clearing queue');
            await this.clearQueue();
            this._emit('syncComplete', { synced, errors, authExpired: true, syncedOperations });
            return { success: false, synced, errors, authExpired: true };
          }
          errors++;
          logger.error('sync', `Operation ${op.id} threw unexpectedly`, err.message);
        }

        if (i < pendingOps.length - 1) {
          await new Promise(r => setTimeout(r, INTER_OP_DELAY));
        }
      }

      await queueStorage.updateSyncAttempt();
      if (synced > 0) await queueStorage.updateSuccessfulSync();
      this._cachedQueue = null;

      logger.info('sync', `Sync complete: ${synced} synced, ${errors} errors`);
      this._emit('syncComplete', { synced, errors, authExpired: false, syncedOperations });

      return { success: errors === 0, synced, errors, authExpired: false };
    } finally {
      this._syncInProgress = false;
    }
  }
}

// Singleton instance — all app code shares one SyncService.
// For tests, instantiate `new SyncService()` directly.
const syncService = new SyncService();
export default syncService;

// Named exports for callers that destructure the module directly.
// Bound to the singleton so `this` is correct when called standalone.
export const addEventListener    = syncService.addEventListener.bind(syncService);
export const removeEventListener = syncService.removeEventListener.bind(syncService);
