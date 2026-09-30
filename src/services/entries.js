import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";

export async function listEntries(yearMonth = null, household = false) {
  const params = new URLSearchParams();
  if (yearMonth)  params.set("yearMonth", yearMonth);
  if (household)  params.set("household", "true");
  const qs = params.toString();
  return authRequest(`/api/entries${qs ? "?" + qs : ""}`);
}

export async function listEntriesByYear(year, household = false) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (household) params.set("household", "true");
  return authRequest(`/api/entries?${params.toString()}`);
}

/**
 * Returns YYYY-MM strings for months that have at least one entry.
 * Cheap endpoint — only date keys, no entry payloads.
 * @param {boolean} household
 * @param {number}  limit  0 = all months; >0 = only the N most-recent months
 */
export async function listActiveMonths(household = false, limit = 0) {
  const params = new URLSearchParams();
  if (household) params.set("household", "true");
  if (limit > 0) params.set("limit", String(limit));
  const qs = params.toString();
  return authRequest(`/api/entries/months${qs ? "?" + qs : ""}`);
}

/**
 * Returns distinct year integers for years that have at least one entry.
 * Cheap endpoint — only year keys, no entry payloads.
 */
export async function listActiveYears(household = false) {
  const qs = household ? "?household=true" : "";
  return authRequest(`/api/entries/years${qs}`);
}

/** Used by syncService to replay a queued entry.create / entry.update */
export async function syncPutEntry(entry) {
  logger.info('data', 'syncPutEntry', { entryId: entry.entryId });
  return authRequest("/api/entries", { method: "POST", body: JSON.stringify(entry) });
}

/** Used by syncService to replay a queued entry.delete */
export async function syncDeleteEntry(entryId) {
  logger.info('data', 'syncDeleteEntry', { entryId });
  return authRequest(`/api/entries/${entryId}`, { method: "DELETE" });
}
