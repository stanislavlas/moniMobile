/**
 * Lightweight pub/sub for entry mutation events on mobile.
 * Allows YearOverviewScreen to invalidate its per-year cache when
 * entries are added, edited, or deleted (including after offline sync).
 */
const listeners = new Set();

export const entryEvents = {
  emit(date) {
    listeners.forEach(fn => { try { fn(date); } catch {} });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
