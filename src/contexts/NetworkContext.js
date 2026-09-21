/**
 * Network Context
 * ---------------
 * Provides app-wide access to connectivity state and sync status.
 * Wraps syncService and NetInfo to give all components a single
 * source of truth for offline/online state.
 *
 * Usage:
 *   const { isOnline, queueSize, isSyncing, sync } = useContext(NetworkContext);
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import syncService from "../services/syncService.js";
import * as queueStorage from "../utils/queueStorage.js";
import { logger } from "../utils/logger.js";

export const NetworkContext = createContext({
  isOnline: true,
  queueSize: 0,
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  sync: async () => {},
  enqueueOperation: async () => {},
});

const SYNC_DEBOUNCE_MS = 500;

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline]       = useState(true);
  const [queueSize, setQueueSize]     = useState(0);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError]     = useState(null);

  const syncDebounceRef = useRef(null);
  const appStateRef     = useRef(AppState.currentState);

  // ── Refresh queue count from storage ──────────────────────────────────────
  const refreshQueueSize = useCallback(async () => {
    const status = await queueStorage.getQueueSummary();
    setQueueSize(status.total);
    if (status.lastSuccessfulSync) setLastSyncTime(status.lastSuccessfulSync);
  }, []);

  // ── Debounced sync trigger ─────────────────────────────────────────────────
  const triggerSync = useCallback(() => {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(async () => {
      logger.info('network', 'Triggering sync');
      setIsSyncing(true);
      setSyncError(null);
      try {
        const result = await syncService.syncAll();
        if (result.authExpired) {
          setSyncError("Session expired. Please log in again.");
        } else if (!result.success && result.errors > 0) {
          setSyncError(`${result.errors} operation(s) failed to sync`);
        } else {
          setSyncError(null);
        }
        if (result.synced > 0) setLastSyncTime(Date.now());
      } catch (err) {
        logger.error('network', 'Sync failed', err.message);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
        await refreshQueueSize();
      }
    }, SYNC_DEBOUNCE_MS);
  }, [refreshQueueSize]);

  // ── Manual sync (exposed to consumers) ────────────────────────────────────
  const sync = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    triggerSync();
  }, [isSyncing, isOnline, triggerSync]);

  // ── Enqueue operation (exposed to consumers) ───────────────────────────────
  const enqueueOperation = useCallback(async (type, payload, userId) => {
    await syncService.enqueue(type, payload, userId);
    await refreshQueueSize();
  }, [refreshQueueSize]);

  // ── Set up network monitoring & sync service events ───────────────────────
  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(state => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });

    // Start network monitoring in sync service
    syncService.initNetworkMonitoring(() => {
      // Called when reconnected — trigger sync
      triggerSync();
    });

    // Listen for network changes
    const handleNetworkChange = ({ isOnline: online }) => {
      setIsOnline(online);
    };
    syncService.addEventListener('networkChange', handleNetworkChange);

    // Listen for queue changes
    const handleQueueChanged = (status) => {
      setQueueSize(status.total || 0);
    };
    syncService.addEventListener('queueChanged', handleQueueChanged);

    // Listen for sync start/complete
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncComplete = ({ synced, errors, authExpired }) => {
      setIsSyncing(false);
      if (authExpired) {
        setSyncError("Session expired. Please log in again.");
      } else if (errors > 0) {
        setSyncError(`${errors} operation(s) failed to sync`);
      } else if (synced > 0) {
        setSyncError(null);
        setLastSyncTime(Date.now());
      }
      refreshQueueSize();
    };
    syncService.addEventListener('syncStart', handleSyncStart);
    syncService.addEventListener('syncComplete', handleSyncComplete);

    // Load initial queue size
    refreshQueueSize();

    return () => {
      syncService.teardownNetworkMonitoring();
      syncService.removeEventListener('networkChange', handleNetworkChange);
      syncService.removeEventListener('queueChanged', handleQueueChanged);
      syncService.removeEventListener('syncStart', handleSyncStart);
      syncService.removeEventListener('syncComplete', handleSyncComplete);
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, [refreshQueueSize, triggerSync]);

  // ── AppState: auto-sync when app returns to foreground ────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isOnline &&
        queueSize > 0
      ) {
        logger.info('network', 'App foregrounded with pending ops — triggering sync');
        triggerSync();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isOnline, queueSize, triggerSync]);

  const value = {
    isOnline,
    queueSize,
    isSyncing,
    lastSyncTime,
    syncError,
    sync,
    enqueueOperation,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
