/**
 * useMonthEntries
 * ---------------
 * Shared hook that manages the per-month fetch + AsyncStorage cache pattern
 * used by both MonthOverviewScreen and HistoryScreen.
 *
 * Handles:
 *   - Seeding monthsData from recentMonths(3)
 *   - Fetching active months from API and merging them in (limited to 12)
 *   - Fetching individual month entries on demand (cache-first)
 *   - Resetting when the household toggle changes
 *   - Invalidating / re-fetching when entryEvents fires
 *
 * @param {string}   cachePrefix   - AsyncStorage key prefix (e.g. "moni_month_cache_")
 * @param {boolean}  showHousehold - Whether to fetch household or personal entries
 * @param {string}   filterMonth   - Currently selected YYYY-MM
 * @returns {{ monthsData, monthCache, fetchMonth, hasMoreMonths, loadMoreMonths }}
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { listEntries, listActiveMonths } from "../services/entries.js";
import { entryEvents } from "./entryEvents.js";
import { transformEntry, recentMonths } from "./entries.js";
import { makeMonthItem, loadMonthCache, saveMonthCache, clearMonthCache } from "./monthCache.js";
import { logger } from "./logger.js";

const INITIAL_MONTH_LIMIT = 6;
const LOAD_MORE_STEP = 6;

export function useMonthEntries(cachePrefix, showHousehold, filterMonth) {
  const [allMonthKeys, setAllMonthKeys] = useState(() => recentMonths(3));
  const [visibleCount, setVisibleCount] = useState(INITIAL_MONTH_LIMIT);
  const [monthCache, setMonthCache] = useState({});
  const [hasMoreMonths, setHasMoreMonths] = useState(false);
  const fetchedMonths = useRef(new Set());

  // Derive the visible slice; map to MonthScroller items
  const monthsData = allMonthKeys.slice(0, visibleCount).map(makeMonthItem);

  // Fetch all months from API upfront; merge with recent window
  useEffect(() => {
    let cancelled = false;
    listActiveMonths(showHousehold, 0)
      .then(data => {
        if (cancelled) return;
        const recent = new Set(recentMonths(3));
        const all = new Set([...(Array.isArray(data) ? data : []), ...recent]);
        const sorted = [...all].sort((a, b) => b.localeCompare(a));
        setAllMonthKeys(sorted);
        setHasMoreMonths(sorted.length > INITIAL_MONTH_LIMIT);
      })
      .catch(() => { /* keep seed */ });
    return () => { cancelled = true; };
  }, [showHousehold]);

  // Reveal next batch — no API call needed
  const loadMoreMonths = useCallback(() => {
    setVisibleCount(prev => {
      const next = prev + LOAD_MORE_STEP;
      setHasMoreMonths(next < allMonthKeys.length);
      return next;
    });
    logger.info("entries", `loadMoreMonths: revealing next ${LOAD_MORE_STEP}`);
  }, [allMonthKeys.length]);

  // Fetch a single month on demand — serve from AsyncStorage cache first, then network
  const fetchMonth = useCallback(async (ym) => {
    if (fetchedMonths.current.has(ym)) return;
    fetchedMonths.current.add(ym);

    const cached = await loadMonthCache(cachePrefix, ym);
    if (cached) setMonthCache(prev => ({ ...prev, [ym]: { entries: cached, loading: true,  error: null } }));
    else        setMonthCache(prev => ({ ...prev, [ym]: { entries: [],     loading: true,  error: null } }));

    try {
      const data = await listEntries(ym, showHousehold);
      const transformed = (Array.isArray(data) ? data : []).map(transformEntry);
      setMonthCache(prev => ({ ...prev, [ym]: { entries: transformed, loading: false, error: null } }));
      saveMonthCache(cachePrefix, ym, transformed);
    } catch (err) {
      fetchedMonths.current.delete(ym); // allow retry
      setMonthCache(prev => ({ ...prev, [ym]: { entries: prev[ym]?.entries ?? [], loading: false, error: err.message } }));
    }
  }, [cachePrefix, showHousehold]);

  // Trigger fetch for the active month
  useEffect(() => { fetchMonth(filterMonth); }, [filterMonth, fetchMonth]);

  // Reset on household toggle — clear cache first, then immediately re-fetch
  // the active month. Combining both into a single effect avoids a race where
  // the separate fetch effect fires before the reset clears stale data.
  useEffect(() => {
    setMonthCache({});
    setAllMonthKeys(recentMonths(3));
    setVisibleCount(INITIAL_MONTH_LIMIT);
    setHasMoreMonths(false);
    fetchedMonths.current = new Set();
    fetchMonth(filterMonth);
  }, [showHousehold]); // eslint-disable-line react-hooks/exhaustive-deps

  // Invalidate month cache when an entry is mutated, then immediately re-fetch
  useEffect(() => {
    return entryEvents.subscribe(date => {
      if (!date) {
        fetchedMonths.current = new Set();
        setMonthCache({});
        return;
      }
      const ym = date.slice(0, 7);
      fetchedMonths.current.delete(ym);
      clearMonthCache(cachePrefix, ym);
      setMonthCache(prev => {
        if (!prev[ym]) return prev;
        const next = { ...prev };
        delete next[ym];
        return next;
      });
      setAllMonthKeys(prev => {
        if (prev.includes(ym)) return prev;
        return [...prev, ym].sort((a, b) => b.localeCompare(a));
      });
      // Re-fetch the invalidated month immediately (mirrors useDashboard behaviour)
      fetchMonth(ym);
    });
  }, [cachePrefix, fetchMonth]);

  return { monthsData, monthCache, fetchMonth, hasMoreMonths, loadMoreMonths };
}

