/**
 * Queue Storage Utility
 * ---------------------
 * AsyncStorage wrapper for offline operation queue persistence.
 * The queue survives app restarts and holds all pending mutations
 * until they are successfully synced to the backend.
 *
 * Queue data structure:
 * {
 *   operations: [
 *     {
 *       id: "uuid-v4",
 *       type: "entry.create" | "entry.update" | "entry.delete" |
 *             "category.create" | "category.delete" |
 *             "household.create" | "household.addMember" | "household.removeMember" |
 *             "household.rename" | "household.leave" | "household.delete",
 *       payload: { /* operation-specific data *\/ },
 *       timestamp: 1234567890,
 *       retryCount: 0,
 *       status: "pending" | "syncing" | "failed",
 *       error: null | string,
 *       userId: "user-id",
 *     }
 *   ],
 *   lastSyncAttempt: 1234567890,
 *   lastSuccessfulSync: 1234567890,
 * }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "budget_sync_queue";
const CONFLICTS_KEY = "budget_sync_conflicts";
const MAX_QUEUE_SIZE = 100;
const MAX_CONFLICTS = 20;

/** Generate a simple unique ID without external dependencies */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Load the full queue state from AsyncStorage */
export async function loadQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) {
      return { operations: [], lastSyncAttempt: null, lastSuccessfulSync: null };
    }
    return JSON.parse(raw);
  } catch {
    return { operations: [], lastSyncAttempt: null, lastSuccessfulSync: null };
  }
}

/** Persist the full queue state to AsyncStorage */
export async function saveQueue(queueState) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queueState));
  } catch {
    // Ignore storage errors — queue is best-effort
  }
}

/**
 * Add an operation to the queue.
 * Returns the new operation object (with generated id + timestamp).
 * Throws if queue is at MAX_QUEUE_SIZE.
 */
export async function addOperation({ type, payload, userId }) {
  const queue = await loadQueue();

  if (queue.operations.length >= MAX_QUEUE_SIZE) {
    throw new Error(`Sync queue is full (${MAX_QUEUE_SIZE} operations). Please sync before adding more changes.`);
  }

  const operation = {
    id: generateId(),
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
    error: null,
    userId: userId || null,
  };

  queue.operations = [...queue.operations, operation];
  await saveQueue(queue);
  return operation;
}

/** Remove an operation from the queue by id */
export async function removeOperation(operationId) {
  const queue = await loadQueue();
  queue.operations = queue.operations.filter(op => op.id !== operationId);
  await saveQueue(queue);
}

/** Update an existing operation's fields (e.g., status, retryCount, error) */
export async function updateOperation(operationId, updates) {
  const queue = await loadQueue();
  queue.operations = queue.operations.map(op =>
    op.id === operationId ? { ...op, ...updates } : op
  );
  await saveQueue(queue);
}

/** Update lastSyncAttempt timestamp */
export async function updateSyncAttempt(timestamp = Date.now()) {
  const queue = await loadQueue();
  queue.lastSyncAttempt = timestamp;
  await saveQueue(queue);
}

/** Update lastSuccessfulSync timestamp */
export async function updateSuccessfulSync(timestamp = Date.now()) {
  const queue = await loadQueue();
  queue.lastSuccessfulSync = timestamp;
  await saveQueue(queue);
}

/** Clear all operations from the queue (used on logout or full reset) */
export async function clearQueue() {
  await saveQueue({ operations: [], lastSyncAttempt: null, lastSuccessfulSync: null });
}

/** Get summary counts of queue by status */
export async function getQueueSummary() {
  const queue = await loadQueue();
  const ops = queue.operations;
  return {
    total: ops.length,
    pending: ops.filter(o => o.status === "pending").length,
    syncing: ops.filter(o => o.status === "syncing").length,
    failed: ops.filter(o => o.status === "failed").length,
    lastSyncAttempt: queue.lastSyncAttempt,
    lastSuccessfulSync: queue.lastSuccessfulSync,
  };
}

/** Append a conflict record (capped at MAX_CONFLICTS) */
export async function logConflict({ operationType, operationId, conflict, resolution }) {
  try {
    const raw = await AsyncStorage.getItem(CONFLICTS_KEY);
    const conflicts = raw ? JSON.parse(raw) : [];
    conflicts.unshift({
      timestamp: Date.now(),
      operationType,
      operationId,
      conflict,
      resolution,
    });
    await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(conflicts.slice(0, MAX_CONFLICTS)));
  } catch {
    // Non-critical — ignore errors
  }
}
