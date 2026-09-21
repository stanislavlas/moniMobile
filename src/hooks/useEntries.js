import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listEntries } from "../services/entries.js";
import { fromApiTransactionType, fromApiNecessity } from "../utils/enums.js";
import { logger } from "../utils/logger.js";
import syncService from "../services/syncService.js";

const LS_KEY     = "budget_cache";
const LS_KEY_ALL = "budget_cache_all";

export async function clearEntriesCache() {
  try { await AsyncStorage.multiRemove([LS_KEY, LS_KEY_ALL]); } catch {}
}

function transformFromApi(entry) {
  return {
    ...entry,
    type:      fromApiTransactionType(entry.type),
    necessity: entry.necessity ? fromApiNecessity(entry.necessity) : undefined,
    amount:    typeof entry.amount === "object" ? entry.amount.value : entry.amount,
    currency:  typeof entry.amount === "object" ? entry.amount.currency : (entry.currency ?? null),
    category:  entry.categoryId,
  };
}

async function loadCache()     { try { return JSON.parse(await AsyncStorage.getItem(LS_KEY)     || "[]"); } catch { return []; } }
async function saveCache(e)    { try { await AsyncStorage.setItem(LS_KEY,     JSON.stringify(e)); } catch {} }
async function loadAllCache()  { try { return JSON.parse(await AsyncStorage.getItem(LS_KEY_ALL) || "[]"); } catch { return []; } }
async function saveAllCache(e) { try { await AsyncStorage.setItem(LS_KEY_ALL, JSON.stringify(e)); } catch {} }

export function useEntries(yearMonth, isAuthenticated, household = false) {
  const [entries,     setEntries]    = useState([]);
  const [allEntries,  setAllEntries] = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [pendingSync, setPendingSync] = useState(new Set());

  const filtered = entries.filter(e => !yearMonth || e.date?.startsWith(yearMonth));

  // ── Reads ──────────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    if (!isAuthenticated) {
      setEntries([]);
      setAllEntries([]);
      setLoading(false);
      return;
    }

    const cachePromise   = loadCache();
    const networkPromise = listEntries(yearMonth, household).catch(err => {
      logger.info('entries', 'fetchEntries network error (will use cache):', err.message);
      return null;
    });

    const cached = await cachePromise;
    if (cached.length > 0) setEntries(cached);
    setLoading(false);

    const data = await networkPromise;
    if (data) {
      const transformed = data.map(transformFromApi);
      setEntries(transformed);
      saveCache(transformed);
    }
  }, [yearMonth, isAuthenticated, household]);

  const fetchAllEntries = useCallback(async () => {
    if (!isAuthenticated) {
      setAllEntries([]);
      return;
    }

    const cachePromise   = loadAllCache();
    const networkPromise = listEntries(null, household).catch(err => {
      logger.info('entries', 'fetchAllEntries network error (will use cache):', err.message);
      return null;
    });

    const cached = await cachePromise;
    if (cached.length > 0) setAllEntries(cached);

    const data = await networkPromise;
    if (data) {
      const transformed = data.map(transformFromApi);
      setAllEntries(transformed);
      saveAllCache(transformed);
    }
  }, [isAuthenticated, household]);

  useEffect(() => { fetchEntries();    }, [fetchEntries]);
  useEffect(() => { fetchAllEntries(); }, [fetchAllEntries]);

  useEffect(() => {
    const handleSyncComplete = ({ syncedOperations = [] }) => {
      const hasEntryOps = syncedOperations.some(op => op.type?.startsWith('entry.'));
      if (!hasEntryOps) return;
      clearEntriesCache().then(() => {
        fetchEntries();
        fetchAllEntries();
      });
    };
    syncService.addEventListener('syncComplete', handleSyncComplete);
    return () => syncService.removeEventListener('syncComplete', handleSyncComplete);
  }, [fetchEntries, fetchAllEntries]);

  // ── Writes ─────────────────────────────────────────────────────────────────
  const addEntry = useCallback(async (entry) => {
    const tempId     = `temp-${Date.now()}`;
    const optimistic = transformFromApi({ ...entry, entryId: tempId, pendingSync: true });

    setEntries(prev    => { const n = [optimistic, ...prev];    saveCache(n);    return n; });
    setAllEntries(prev => { const n = [optimistic, ...prev];    saveAllCache(n); return n; });
    setPendingSync(prev => new Set([...prev, tempId]));

    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("entry.batchCreate", { entries: [entry], tempIds: [tempId] }, user?.userId);
      svc.syncAll().catch(() => {});
    } catch (err) {
      logger.error('entries', 'Failed to enqueue addEntry', err.message);
    }
  }, []);

  const updateEntry = useCallback(async (updated) => {
    setEntries(prev => {
      const n = prev.map(e => e.entryId === updated.entryId ? { ...updated, pendingSync: true } : e);
      saveCache(n);
      return n;
    });
    setPendingSync(prev => new Set([...prev, updated.entryId]));

    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("entry.update", updated, user?.userId);
      svc.syncAll().catch(() => {});
    } catch (err) {
      logger.error('entries', 'Failed to enqueue updateEntry', err.message);
    }
  }, []);

  const removeEntry = useCallback(async (entryId) => {
    setEntries(prev    => { const n = prev.filter(e => e.entryId !== entryId); saveCache(n);    return n; });
    setAllEntries(prev => { const n = prev.filter(e => e.entryId !== entryId); saveAllCache(n); return n; });
    setPendingSync(prev => { const next = new Set(prev); next.delete(entryId); return next; });

    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("entry.delete", { entryId }, user?.userId);
      svc.syncAll().catch(() => {});
    } catch (err) {
      logger.error('entries', 'Failed to enqueue removeEntry', err.message);
    }
  }, []);

  return {
    entries: filtered,
    allEntries,
    loading,
    error: null,
    addEntry,
    updateEntry,
    removeEntry,
    refresh: fetchEntries,
    refreshAll: useCallback(async () => {
      await clearEntriesCache();
      await Promise.all([fetchEntries(), fetchAllEntries()]);
    }, [fetchEntries, fetchAllEntries]),
    pendingSync,
  };
}
