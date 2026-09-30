/**
 * monthCache.js
 * -------------
 * Shared helpers used by both useDashboard and useMonthEntries.
 * Extracted to avoid duplication between the two hooks.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Convert a YYYY-MM key to a { key, month, year } display item.
 * @param {string} key  e.g. "2024-03"
 */
export function makeMonthItem(key) {
  const d = new Date(key + "-01");
  return { key, month: d.getMonth(), year: d.getFullYear() };
}

/** Load a cached value for the given month key from AsyncStorage. */
export async function loadMonthCache(prefix, ym) {
  try { return JSON.parse(await AsyncStorage.getItem(prefix + ym) || "null"); } catch { return null; }
}

/** Persist a value for the given month key to AsyncStorage. */
export async function saveMonthCache(prefix, ym, data) {
  try { await AsyncStorage.setItem(prefix + ym, JSON.stringify(data)); } catch {}
}

/** Remove the cached value for the given month key from AsyncStorage. */
export async function clearMonthCache(prefix, ym) {
  try { await AsyncStorage.removeItem(prefix + ym); } catch {}
}
