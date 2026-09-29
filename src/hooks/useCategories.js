import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  listCustomCategories,
  createCustomCategory,
} from "../services/customCategories.js";
import { fromApiTransactionType } from "../utils/enums.js";
import syncService from "../services/syncService.js";
import { enqueueAndSync } from "../utils/enqueueAndSync.js";
import { logger } from "../utils/logger.js";

const CACHE_KEY = "moni_custom_categories";

const COLOR_PALETTE = [
  "#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#EF9F27",
  "#D4537E", "#5DCAA5", "#534AB7", "#BA7517", "#185FA5",
  "#993556", "#63B3ED", "#888780", "#F0997B", "#AFA9EC",
];
function pickColor(categoryId) {
  // Hash the categoryId so the same category always gets the same fallback color,
  // regardless of its position in the array.
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

async function loadCached() { try { return JSON.parse(await AsyncStorage.getItem(CACHE_KEY) || "[]"); } catch { return []; } }
async function saveCache(c) { try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {} }

function transformCategory(cat) {
  return {
    categoryId: cat.categoryId,
    id:         cat.categoryId,
    label:      cat.name,
    emoji:      cat.emoji,
    color:      cat.color,
    type:       fromApiTransactionType(cat.type),
    isDefault:  cat.isDefault || false,
  };
}

export function useCategories(isAuthenticated, householdId) {
  const [allCats,     setAllCats]    = useState([]);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState(null);

  // ── Read: cache + network in parallel ─────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    if (!isAuthenticated) return;

    const cachePromise   = loadCached();
    const networkPromise = listCustomCategories().catch(err => {
      if (err.code === "AUTH_EXPIRED") throw err;
      logger.info?.('categories', 'network error, using cache:', err.message);
      setError(err.message);
      return null;
    });

    const cached = await cachePromise;
    if (cached.length > 0) setAllCats(cached);
    // Keep loading=true until the network response also arrives
    setLoading(true);

    const data = await networkPromise;
    if (data) {
      const transformed = data.map(transformCategory);
      setAllCats(prev => {
        const pendingCats = prev.filter(c => c.pendingSync);
        const seen = new Set(transformed.map(c => c.categoryId));
        const merged = [...transformed, ...pendingCats.filter(c => !seen.has(c.categoryId))];
        saveCache(merged);
        return merged;
      });
      setError(null);
    }
    setLoading(false);
  }, [isAuthenticated]);

  // Initial fetch + re-fetch when authentication state changes
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Re-fetch (and clear stale cache) when household membership changes — the
  // server switches between personal and household-scoped categories based on
  // the user's householdId, so the local cache becomes invalid on join/leave.
  const prevHouseholdIdRef = useRef(householdId);
  useEffect(() => {
    if (prevHouseholdIdRef.current === householdId) return;
    prevHouseholdIdRef.current = householdId;
    if (!isAuthenticated) return;
    setAllCats([]);
    saveCache([]);
    fetchCategories();
  }, [householdId, isAuthenticated, fetchCategories]);

  useEffect(() => {
    const handleSyncComplete = ({ syncedOperations = [] }) => {
      const catOps = syncedOperations.filter(op => op.type?.startsWith('category.'));
      if (catOps.length === 0) return;
      fetchCategories();
    };
    syncService.addEventListener('syncComplete', handleSyncComplete);
    return () => syncService.removeEventListener('syncComplete', handleSyncComplete);
  }, [fetchCategories]);

  // ── Writes ─────────────────────────────────────────────────────────────────
  const createCategory = useCallback(async ({ label, emoji, type }) => {
    if (!syncService.isOnline()) {
      throw new Error("You are offline. Please connect to the internet to add a category.");
    }
    const result = await createCustomCategory({ label, emoji, type, color: "#7F77DD" }, { skipQueue: true });
    await fetchCategories();
    return result;
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (categoryId) => {
    if (categoryId.startsWith("temp-")) {
      setAllCats(prev => { const n = prev.filter(c => c.categoryId !== categoryId); saveCache(n); return n; });
      return;
    }

    setAllCats(prev => { const n = prev.filter(c => c.categoryId !== categoryId); saveCache(n); return n; });

    try {
      await enqueueAndSync("category.delete", { categoryId });
    } catch (err) {
      logger.warn?.('categories', 'Failed to enqueue deleteCategory', err.message);
    }
  }, []);

  const incomeCategories     = allCats.filter(c => c.type === "income");
  const expenseCategories    = allCats.filter(c => c.type === "expense");
  const investmentCategories = allCats.filter(c => c.type === "investment");
  const customCats           = allCats.filter(c => !c.isDefault);
  const colorMap          = Object.fromEntries(allCats.map((c) => [c.categoryId, c.color || pickColor(c.categoryId)]));

  function getCategoryById(id) {
    return allCats.find(c => c.categoryId === id) || { id, categoryId: id, label: id, emoji: "❓" };
  }

  return { incomeCategories, expenseCategories, investmentCategories, allCategories: allCats, customCats, colorMap, getCategoryById, loading, error, createCategory, deleteCategory, refresh: fetchCategories };
}
