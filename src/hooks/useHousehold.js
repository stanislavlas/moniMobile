import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyHousehold } from "../services/household.js";
import syncService from "../services/syncService.js";

const CACHE_KEY = "budget_cache_household";

async function loadCache()  { try { return JSON.parse(await AsyncStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } }
async function saveCache(h) { try { if (h) await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(h)); else await AsyncStorage.removeItem(CACHE_KEY); } catch {} }

export async function clearHouseholdCache() {
  try { await AsyncStorage.removeItem(CACHE_KEY); } catch {}
}

export function useHousehold(isAuthenticated) {
  const [household,   setHousehold]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [pendingSync, setPendingSync] = useState(false);

  // ── Read: cache + network in parallel ─────────────────────────────────────
  const fetch = useCallback(async () => {
    if (!isAuthenticated) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    const cachePromise   = loadCache();
    const networkPromise = getMyHousehold().catch(err => {
      if (err.code === "AUTH_EXPIRED") throw err;
      return null;
    });

    const cached = await cachePromise;
    if (cached) setHousehold(cached);
    setLoading(false);

    const data = await networkPromise;
    if (data !== null) {
      setHousehold(data);
      saveCache(data);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const handleSyncComplete = ({ syncedOperations = [] }) => {
      if (syncedOperations.some(op => op.type?.startsWith('household.'))) {
        setPendingSync(false);
        fetch();
      }
    };
    syncService.addEventListener('syncComplete', handleSyncComplete);
    return () => syncService.removeEventListener('syncComplete', handleSyncComplete);
  }, [fetch]);

  // ── Writes: optimistic update + enqueue + background sync ─────────────────
  const createHousehold = useCallback(async (name) => {
    const optimistic = { name, members: [], pendingSync: true };
    setHousehold(optimistic); saveCache(optimistic); setPendingSync(true);
    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("household.create", { name }, user?.userId);
      svc.syncAll().catch(() => {});
    } catch {}
  }, []);

  const addMember = useCallback(async (email) => {
    const { addMember: addMemberService } = await import("../services/household.js");
    const result = await addMemberService(email);
    if (result && !result.queued) {
      setHousehold(result);
      saveCache(result);
    } else if (result?.queued) {
      setPendingSync(true);
    }
  }, []);

  const removeMember = useCallback(async (memberId) => {
    setHousehold(prev => {
      if (!prev) return prev;
      const updated = { ...prev, members: prev.members?.filter(m => m.userId !== memberId) || [], pendingSync: true };
      saveCache(updated); return updated;
    });
    setPendingSync(true);
    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("household.removeMember", { memberId }, user?.userId);
      svc.syncAll().catch(() => {});
    } catch {}
  }, []);

  const leaveHousehold = useCallback(async () => {
    setHousehold(null); saveCache(null); setPendingSync(true);
    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("household.leave", {}, user?.userId);
      svc.syncAll().catch(() => {});
    } catch {}
  }, []);

  const deleteHousehold = useCallback(async () => {
    setHousehold(null); saveCache(null); setPendingSync(true);
    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("household.delete", {}, user?.userId);
      svc.syncAll().catch(() => {});
    } catch {}
  }, []);

  const renameHousehold = useCallback(async (name) => {
    setHousehold(prev => {
      if (!prev) return prev;
      const updated = { ...prev, name, pendingSync: true };
      saveCache(updated); return updated;
    });
    setPendingSync(true);
    try {
      const { default: svc } = await import("../services/syncService.js");
      const { getStoredUser } = await import("../services/auth.js");
      const user = await getStoredUser();
      await svc.enqueue("household.rename", { name }, user?.userId);
      svc.syncAll().catch(() => {});
    } catch {}
  }, []);

  return { household, loading, error: null, refresh: fetch, createHousehold, addMember, removeMember, leaveHousehold, deleteHousehold, renameHousehold, pendingSync };
}
