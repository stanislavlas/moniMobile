/**
 * useDashboard
 * ------------
 * Per-month dashboard cache backed by the GET /api/dashboard endpoint.
 * Mirrors the useMonthEntries pattern: AsyncStorage cache-first, then network.
 *
 * The API returns pre-computed totals (totalIncome, totalExpenses,
 * totalInvestments, savedAmount, necessaryVsOptional, expensesByCategory,
 * memberBreakdown) — no client-side summation needed.
 *
 * @param {string}  cachePrefix   - AsyncStorage key prefix (e.g. "moni_dashboard_cache_")
 * @param {boolean} showHousehold - Whether to fetch household or personal data
 * @param {string}  filterMonth   - Currently selected YYYY-MM
 * @returns {{ monthsData, dashboardCache, fetchDashboard }}
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getDashboard } from "../services/dashboard.js";
import { listActiveMonths } from "../services/entries.js";
import { entryEvents } from "./entryEvents.js";
import { recentMonths } from "./entries.js";
import { logger } from "./logger.js";
import { makeMonthItem, loadMonthCache, saveMonthCache, clearMonthCache } from "./monthCache.js";

function lastDayOf(ym) {
  const [y, mo] = ym.split("-");
  return new Date(Number(y), Number(mo), 0).getDate();
}

export function useDashboard(cachePrefix, showHousehold, filterMonth) {
  const [monthsData, setMonthsData] = useState(() =>
    recentMonths(3).map(makeMonthItem)
  );
  const [dashboardCache, setDashboardCache] = useState({});
  const fetchedMonths = useRef(new Set());

  // Fetch distinct months from API; merge with recent window
  useEffect(() => {
    let cancelled = false;
    listActiveMonths(showHousehold)
      .then(data => {
        if (cancelled) return;
        const recent = new Set(recentMonths(3));
        const all = new Set([...(Array.isArray(data) ? data : []), ...recent]);
        const sorted = [...all].sort((a, b) => b.localeCompare(a));
        logger.info("dashboard", `activeMonths loaded: ${sorted.length} (household=${showHousehold})`);
        setMonthsData(sorted.map(makeMonthItem));
      })
      .catch(() => { /* keep seed */ });
    return () => { cancelled = true; };
  }, [showHousehold]);

  // Fetch dashboard for a single month on demand — AsyncStorage cache-first
  const fetchDashboard = useCallback(async (ym) => {
    if (fetchedMonths.current.has(ym)) return;
    fetchedMonths.current.add(ym);

    const fromDate = `${ym}-01`;
    const toDate   = `${ym}-${String(lastDayOf(ym)).padStart(2, "0")}`;

    // Serve stale cache immediately while network request is in-flight
    const cached = await loadMonthCache(cachePrefix, ym);
    if (cached) setDashboardCache(prev => ({ ...prev, [ym]: { data: cached, loading: true,  error: null } }));
    else        setDashboardCache(prev => ({ ...prev, [ym]: { data: null,   loading: true,  error: null } }));

    try {
      logger.info("dashboard", `fetchDashboard: ${ym} (${fromDate} → ${toDate})`);
      const data = await getDashboard(fromDate, toDate, showHousehold);
      setDashboardCache(prev => ({ ...prev, [ym]: { data, loading: false, error: null } }));
      saveMonthCache(cachePrefix, ym, data);
    } catch (err) {
      logger.error("dashboard", `fetchDashboard error: ${ym}`, err.message);
      fetchedMonths.current.delete(ym); // allow retry
      setDashboardCache(prev => ({
        ...prev,
        [ym]: { data: prev[ym]?.data ?? null, loading: false, error: err.message },
      }));
    }
  }, [cachePrefix, showHousehold]);

  // Trigger fetch for the active month
  useEffect(() => { fetchDashboard(filterMonth); }, [filterMonth, fetchDashboard]);

  // Reset on household toggle — clear cache first, then immediately re-fetch
  // the active month. Combining both into a single effect avoids a race where
  // the separate fetch effect fires before the reset clears stale data.
  useEffect(() => {
    logger.info("dashboard", `household toggle (${showHousehold}) — resetting dashboard cache`);
    setDashboardCache({});
    setMonthsData(recentMonths(3).map(makeMonthItem));
    fetchedMonths.current = new Set();
    fetchDashboard(filterMonth);
  }, [showHousehold]); // eslint-disable-line react-hooks/exhaustive-deps

  // Invalidate month cache when an entry is mutated, then immediately re-fetch
  useEffect(() => {
    return entryEvents.subscribe(date => {
      if (!date) {
        fetchedMonths.current = new Set();
        setDashboardCache({});
        return;
      }
      const ym = date.slice(0, 7);
      logger.info("dashboard", `invalidating dashboard cache: ${ym} (entry event)`);
      fetchedMonths.current.delete(ym);
      clearMonthCache(cachePrefix, ym);
      setDashboardCache(prev => {
        if (!prev[ym]) return prev;
        const next = { ...prev };
        delete next[ym];
        return next;
      });
      setMonthsData(prev => {
        if (prev.some(m => m.key === ym)) return prev;
        return [...prev, makeMonthItem(ym)].sort((a, b) => b.key.localeCompare(a.key));
      });
      // Re-fetch the invalidated month immediately
      fetchDashboard(ym);
    });
  }, [cachePrefix, fetchDashboard]);

  return { monthsData, dashboardCache, fetchDashboard };
}
