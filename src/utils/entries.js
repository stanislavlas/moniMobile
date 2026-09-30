/**
 * Shared entry utilities used by MonthOverviewScreen and HistoryScreen.
 */
import { fromApiNecessity, fromApiTransactionType } from "./enums.js";

/**
 * Normalise a raw API entry to the UI representation.
 * - type:      API uppercase → UI lowercase
 * - necessity: API uppercase → UI lowercase (only when present)
 * - amount:    unwrap { value } object form if needed
 */
export function transformEntry(e) {
  return {
    ...e,
    type:      fromApiTransactionType(e.type),
    necessity: e.necessity ? fromApiNecessity(e.necessity) : undefined,
    amount:    typeof e.amount === "object" ? parseFloat(e.amount.value) : e.amount,
  };
}

/**
 * Returns YYYY-MM strings for the last [n] months ending today, newest first.
 */
export function recentMonths(n = 3) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Returns the current month as a "YYYY-MM" string.
 * Computed once at module load time — suitable as a default state initializer.
 * Use this instead of duplicating the inline computation everywhere.
 */
const _now = new Date();
export const currentYearMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
