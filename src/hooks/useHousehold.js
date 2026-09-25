import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyHousehold, getPendingInvitations } from "../services/household.js";
import { enqueueAndSync } from "../utils/enqueueAndSync.js";
import syncService from "../services/syncService.js";

const CACHE_KEY       = "budget_cache_household";
const INVITATIONS_KEY = "budget_cache_pending_invitations";

async function loadCache(key)      { try { return JSON.parse(await AsyncStorage.getItem(key) || "null"); } catch { return null; } }
async function saveCache(key, val) { try { if (val != null) await AsyncStorage.setItem(key, JSON.stringify(val)); else await AsyncStorage.removeItem(key); } catch {} }

export async function clearHouseholdCache() {
  try { await Promise.all([AsyncStorage.removeItem(CACHE_KEY), AsyncStorage.removeItem(INVITATIONS_KEY)]); } catch {}
}

/** Lazy-loaded once — expo-notifications may be unavailable in Expo Go */
let expoNotifications = null;
async function getExpoNotifications() {
  if (expoNotifications) return expoNotifications;
  try {
    expoNotifications = require("expo-notifications");
    if (typeof expoNotifications.scheduleNotificationAsync !== "function") {
      expoNotifications = null;
    }
  } catch {
    expoNotifications = null;
  }
  return expoNotifications;
}

/** Fire a local push notification for each invitation not seen before. */
async function notifyNewInvitations(newInvitations, seenIds) {
  if (!newInvitations.length) return;
  try {
    const mod = await getExpoNotifications();
    if (!mod) return;
    for (const inv of newInvitations) {
      if (seenIds.has(inv.invitationId)) continue;
      await mod.scheduleNotificationAsync({
        content: {
          title: "Household invitation",
          body: `${inv.invitedByName} invited you to join "${inv.householdName}"`,
        },
        trigger: null, // fire immediately
      });
    }
  } catch {
    // expo-notifications unavailable in Expo Go — ignore silently
  }
}

export function useHousehold(isAuthenticated) {
  const [household,          setHousehold]  = useState(null);
  const [pendingInvitations, setPending]    = useState([]);
  const [loading,            setLoading]    = useState(true);
  const [error,              setError]      = useState(null);
  const [pendingSync,        setPendingSync] = useState(false);

  // Track which invitation IDs have already triggered a notification this session
  const notifiedIds = useRef(new Set());

  const fetch = useCallback(async () => {
    if (!isAuthenticated) {
      setHousehold(null); setPending([]); setLoading(false); return;
    }

    // Seed UI from cache immediately
    const [cachedHH, cachedInv] = await Promise.all([loadCache(CACHE_KEY), loadCache(INVITATIONS_KEY)]);
    if (cachedHH)  setHousehold(cachedHH);
    if (cachedInv) setPending(cachedInv);
    setLoading(false);

    try {
      const [hh, invitations] = await Promise.all([
        getMyHousehold().catch(err => { if (err.code === "AUTH_EXPIRED") throw err; return null; }),
        getPendingInvitations().catch(() => []),
      ]);
      if (hh !== null) { setHousehold(hh); saveCache(CACHE_KEY, hh); }

      // Notify for any invitations not yet seen this session
      await notifyNewInvitations(invitations, notifiedIds.current);
      invitations.forEach(i => notifiedIds.current.add(i.invitationId));

      setPending(invitations);
      saveCache(INVITATIONS_KEY, invitations);
    } catch (err) {
      if (err.code === "AUTH_EXPIRED") throw err;
      // other errors: swallow — cached state is already shown
    }
  }, [isAuthenticated]);

  useEffect(() => { fetch(); }, [fetch]);

  // Re-poll when a household sync operation completes
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

  const createHousehold = useCallback(async (name) => {
    const previous = household;
    const previousCache = await loadCache(CACHE_KEY);
    const optimistic = { name, members: [], pendingSync: true };
    setHousehold(optimistic); saveCache(CACHE_KEY, optimistic); setPendingSync(true);
    try {
      await enqueueAndSync("household.create", { name });
    } catch (err) {
      // Roll back optimistic update
      setHousehold(previous); saveCache(CACHE_KEY, previousCache);
      setPendingSync(false);
      setError(err.message ?? "Failed to create household");
      throw err;
    }
  }, [household]);

  const sendInvitation = useCallback(async (email) => {
    const { sendInvitation: svc } = await import("../services/household.js");
    return svc(email);
  }, []);

  const acceptInvitation = useCallback(async (invitationId) => {
    const { acceptInvitation: svc } = await import("../services/household.js");
    const result = await svc(invitationId);
    setPending(prev => prev.filter(i => i.invitationId !== invitationId));
    await fetch(); // reload household now that we've joined
    return result;
  }, [fetch]);

  const rejectInvitation = useCallback(async (invitationId) => {
    const { rejectInvitation: svc } = await import("../services/household.js");
    await svc(invitationId);
    setPending(prev => prev.filter(i => i.invitationId !== invitationId));
  }, []);

  const cancelInvitation = useCallback(async (invitationId) => {
    const { cancelInvitation: svc } = await import("../services/household.js");
    return svc(invitationId);
  }, []);

  const removeMember = useCallback(async (memberId) => {
    const previous = household;
    const previousCache = await loadCache(CACHE_KEY);
    setHousehold(prev => {
      if (!prev) return prev;
      const updated = { ...prev, members: prev.members?.filter(m => m.userId !== memberId) || [], pendingSync: true };
      saveCache(CACHE_KEY, updated); return updated;
    });
    setPendingSync(true);
    try {
      await enqueueAndSync("household.removeMember", { memberId });
    } catch (err) {
      setHousehold(previous); saveCache(CACHE_KEY, previousCache);
      setPendingSync(false);
      setError(err.message ?? "Failed to remove member");
      throw err;
    }
  }, [household]);

  const leaveHousehold = useCallback(async () => {
    const previous = household;
    const previousCache = await loadCache(CACHE_KEY);
    setHousehold(null); saveCache(CACHE_KEY, null); setPendingSync(true);
    try {
      await enqueueAndSync("household.leave", {});
    } catch (err) {
      setHousehold(previous); saveCache(CACHE_KEY, previousCache);
      setPendingSync(false);
      setError(err.message ?? "Failed to leave household");
      throw err;
    }
  }, [household]);

  const deleteHousehold = useCallback(async () => {
    const previous = household;
    const previousCache = await loadCache(CACHE_KEY);
    setHousehold(null); saveCache(CACHE_KEY, null); setPendingSync(true);
    try {
      await enqueueAndSync("household.delete", {});
    } catch (err) {
      setHousehold(previous); saveCache(CACHE_KEY, previousCache);
      setPendingSync(false);
      setError(err.message ?? "Failed to delete household");
      throw err;
    }
  }, [household]);

  const renameHousehold = useCallback(async (name) => {
    const previous = household;
    const previousCache = await loadCache(CACHE_KEY);
    setHousehold(prev => {
      if (!prev) return prev;
      const updated = { ...prev, name, pendingSync: true };
      saveCache(CACHE_KEY, updated); return updated;
    });
    setPendingSync(true);
    try {
      await enqueueAndSync("household.rename", { name });
    } catch (err) {
      setHousehold(previous); saveCache(CACHE_KEY, previousCache);
      setPendingSync(false);
      setError(err.message ?? "Failed to rename household");
      throw err;
    }
  }, [household]);

  return {
    household, pendingInvitations,
    pendingCount: pendingInvitations.length,
    loading, error, refresh: fetch,
    createHousehold, sendInvitation, acceptInvitation, rejectInvitation, cancelInvitation,
    removeMember, leaveHousehold, deleteHousehold, renameHousehold, pendingSync,
  };
}
