import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";

export async function listEntries(yearMonth = null, household = false) {
  const params = new URLSearchParams();
  if (yearMonth)  params.set("yearMonth", yearMonth);
  if (household)  params.set("household", "true");
  const qs = params.toString();
  return authRequest(`/api/entries${qs ? "?" + qs : ""}`);
}

/** Used by syncService to replay a single queued entry.create / entry.update */
export async function syncPutEntry(entry) {
  logger.info('data', 'syncPutEntry', { entryId: entry.entryId });
  return authRequest("/api/entries", { method: "POST", body: JSON.stringify(entry) });
}

/** Used by syncService to replay a batch of queued entry.create operations */
export async function syncBatchCreateEntries(entries) {
  logger.info('data', 'syncBatchCreateEntries', { count: entries.length });
  return authRequest("/api/entries/batch", { method: "POST", body: JSON.stringify(entries) });
}

/** Used by syncService to replay a queued entry.delete */
export async function syncDeleteEntry(entryId) {
  logger.info('data', 'syncDeleteEntry', { entryId });
  return authRequest(`/api/entries/${entryId}`, { method: "DELETE" });
}
