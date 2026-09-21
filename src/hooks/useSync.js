/**
 * useSync Hook
 * ------------
 * Convenience hook for accessing network state and sync functionality.
 * Consumes NetworkContext — must be inside a NetworkProvider.
 *
 * Usage:
 *   const { isOnline, queueSize, isSyncing, sync, canSync } = useSync();
 */

import { useNetwork } from "../contexts/NetworkContext.js";

export function useSync() {
  const { isOnline, queueSize, isSyncing, lastSyncTime, syncError, sync, enqueueOperation } = useNetwork();

  return {
    isOnline,
    queueSize,
    isSyncing,
    lastSyncTime,
    syncError,
    sync,
    enqueueOperation,
    /** True when network is available AND no sync is already running */
    canSync: isOnline && !isSyncing,
  };
}
