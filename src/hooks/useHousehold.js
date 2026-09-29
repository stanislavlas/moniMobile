import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMyHousehold,
  getPendingInvitations,
  sendInvitation as apiSendInvitation,
  acceptInvitation as apiAcceptInvitation,
  rejectInvitation as apiRejectInvitation,
  cancelInvitation as apiCancelInvitation,
} from "../services/household.js";
import { enqueueAndSync } from "../utils/enqueueAndSync.js";
import syncService from "../services/syncService.js";

const CACHE_KEY       = "moni_cache_household";
const INVITATIONS_KEY = "moni_cache_pending_invitations";

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
        trigger: null,
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
      setHousehold(hh ?? null);
      saveCache(CACHE_KEY, hh ?? null);

      await notifyNewInvitations(invitations, notifiedIds.current);
      invitations.forEach(i => notifiedIds.current.add(i.invitationId));

      setPending(invitations);
      saveCache(INVITATIONS_KEY, invitations);
    } catch (err) {
      if (err.code === "AUTH_EXPIRED") throw err;
      // Surface network/server errors to the caller instead of swallowing them
      setError(err.message ?? "Failed to load household data");
    }
  }, [isAuthenticated]);

  useEffect(() => { fetch(); }, [fetch]);

  // Re-poll when a household sync operation completes
  useEffect(() => {
    const handleSyncComplete = ({ syncedOperations = [] }) => {
      if (syncedOperations.some(op => op.type?.startsWith('household.'))) {
        fetch();
      }
    };
    syncService.addEventListener('syncComplete', handleSyncComplete);
    return () => syncService.removeEventListener('syncComplete', handleSyncComplete);
  }, [fetch]);

  // All mutating operations: enqueue and then refresh from server (no optimistic state)
  const createHousehold = useCallback(async (name) => {
    setError(null);
    try {
      await enqueueAndSync("household.create", { name });
    } catch (err) {
      setError(err.message ?? "Failed to create household");
      throw err;
    }
  }, []);

  const sendInvitation = useCallback(async (email) => {
    return apiSendInvitation(email);
  }, []);

  const acceptInvitation = useCallback(async (invitationId) => {
    const result = await apiAcceptInvitation(invitationId);
    setPending(prev => prev.filter(i => i.invitationId !== invitationId));
    await fetch();
    return result;
  }, [fetch]);

  const rejectInvitation = useCallback(async (invitationId) => {
    await apiRejectInvitation(invitationId);
    setPending(prev => prev.filter(i => i.invitationId !== invitationId));
  }, []);

  const cancelInvitation = useCallback(async (invitationId) => {
    return apiCancelInvitation(invitationId);
  }, []);

  const removeMember = useCallback(async (memberId) => {
    setError(null);
    try {
      await enqueueAndSync("household.removeMember", { memberId });
    } catch (err) {
      setError(err.message ?? "Failed to remove member");
      throw err;
    }
  }, []);

  const leaveHousehold = useCallback(async () => {
    setError(null);
    try {
      await enqueueAndSync("household.leave", {});
      setHousehold(null);
      saveCache(CACHE_KEY, null);
    } catch (err) {
      setError(err.message ?? "Failed to leave household");
      throw err;
    }
  }, []);

  const deleteHousehold = useCallback(async () => {
    setError(null);
    try {
      await enqueueAndSync("household.delete", {});
      setHousehold(null);
      saveCache(CACHE_KEY, null);
    } catch (err) {
      setError(err.message ?? "Failed to delete household");
      throw err;
    }
  }, []);

  const renameHousehold = useCallback(async (name) => {
    setError(null);
    try {
      await enqueueAndSync("household.rename", { name });
    } catch (err) {
      setError(err.message ?? "Failed to rename household");
      throw err;
    }
  }, []);

  return {
    household, pendingInvitations,
    pendingCount: pendingInvitations.length,
    loading, error, refresh: fetch,
    createHousehold, sendInvitation, acceptInvitation, rejectInvitation, cancelInvitation,
    removeMember, leaveHousehold, deleteHousehold, renameHousehold,
  };
}
