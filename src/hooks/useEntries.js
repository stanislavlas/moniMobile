/**
 * useEntries — mutation-only hook for mobile.
 *
 * Read functionality (fetching, caching) has been moved into each screen
 * (MonthOverviewScreen, HistoryScreen, YearOverviewScreen) which each manage
 * their own per-period cache.
 *
 * This hook provides:
 *   - addEntry / updateEntry / removeEntry  (offline-first via syncService)
 *   - pendingSync Set  (entry IDs awaiting server confirmation)
 *   - refreshAll       (clears all period caches and re-triggers fetches via entryEvents)
 *
 * pendingSync is seeded from the persisted queue on mount so that entries
 * which were pending before the app was killed still show the PENDING badge.
 */
import { useState, useCallback, useEffect } from "react";
import { logger } from "../utils/logger.js";
import { enqueueAndSync } from "../utils/enqueueAndSync.js";
import { entryEvents } from "../utils/entryEvents.js";
import syncService from "../services/syncService.js";

/** Extract entry IDs from the persisted queue (for seeding pendingSync on startup). */
async function loadPersistedPendingIds() {
  try {
    const status = await syncService.getQueueStatus();
    if (status.total === 0) return new Set();
    // Load actual operations to extract entry IDs
    const { loadQueue } = await import("../utils/queueStorage.js");
    const queue = await loadQueue();
    const ids = new Set();
    for (const op of queue.operations) {
      if (op.status !== "pending" && op.status !== "failed") continue;
      if (op.payload?.entryId) ids.add(op.payload.entryId);
    }
    return ids;
  } catch {
    return new Set();
  }
}

export async function clearEntriesCache() {
  // Per-screen caches are managed independently.
  // Emit a sentinel to signal all screens to invalidate.
  entryEvents.emit(null);
}

export function useEntries() {
  const [pendingSync, setPendingSync] = useState(new Set());

  // Seed pendingSync from persisted queue on mount so PENDING badges survive app restart
  useEffect(() => {
    loadPersistedPendingIds().then(ids => {
      if (ids.size > 0) setPendingSync(ids);
    });
  }, []);

  // Clear pendingSync entries that were successfully synced
  useEffect(() => {
    const handleSyncComplete = ({ syncedOperations = [] }) => {
      const syncedIds = new Set(
        syncedOperations
          .filter(op => op.payload?.entryId)
          .map(op => op.payload.entryId)
      );
      if (syncedIds.size > 0) {
        setPendingSync(prev => {
          const next = new Set(prev);
          syncedIds.forEach(id => next.delete(id));
          return next;
        });
      }
    };
    syncService.addEventListener('syncComplete', handleSyncComplete);
    return () => syncService.removeEventListener('syncComplete', handleSyncComplete);
  }, []);

  const addEntry = useCallback(async (entry) => {
    if (entry.date) entryEvents.emit(entry.date);

    // Note: new entries don't get a PENDING badge because the server assigns
    // the entryId and we don't know it yet at enqueue time. The UI already
    // shows a cache-first refresh (history screen re-fetches on entryEvent),
    // so the entry appears immediately without a stale-looking PENDING label.
    try {
      await enqueueAndSync("entry.create", entry);
    } catch (err) {
      logger.error('entries', 'Failed to enqueue addEntry', err?.message ?? String(err));
      throw err;
    }
  }, []);

  const updateEntry = useCallback(async (updated) => {
    setPendingSync(prev => new Set([...prev, updated.entryId]));

    if (updated.date) entryEvents.emit(updated.date);

    try {
      await enqueueAndSync("entry.update", updated);
    } catch (err) {
      logger.error('entries', 'Failed to enqueue updateEntry', err?.message ?? String(err));
      // Enqueue itself failed — remove from pending so badge doesn't stick
      setPendingSync(prev => { const next = new Set(prev); next.delete(updated.entryId); return next; });
      throw err;
    }
  }, []);

  const removeEntry = useCallback(async (entryId, date) => {
    setPendingSync(prev => new Set([...prev, entryId]));

    if (date) entryEvents.emit(date);

    try {
      await enqueueAndSync("entry.delete", { entryId });
    } catch (err) {
      logger.error('entries', 'Failed to enqueue removeEntry', err?.message ?? String(err));
      // Enqueue itself failed — remove from pending so badge doesn't stick
      setPendingSync(prev => { const next = new Set(prev); next.delete(entryId); return next; });
      throw err;
    }
  }, []);

  const refreshAll = useCallback(() => {
    // Null sentinel tells all screen caches to fully invalidate and re-fetch
    entryEvents.emit(null);
  }, []);

  return { addEntry, updateEntry, removeEntry, pendingSync, refreshAll };
}
