import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";

// NOTE: this file is intentionally kept in sync with
// moniWeb/src/services/recurring.js — mirror any changes there too.

export function listRecurring() {
  logger.info("recurring", "listRecurring");
  return authRequest("/api/recurring");
}

export function createRecurring(template) {
  logger.info("recurring", "createRecurring", { frequency: template.frequency });
  return authRequest("/api/recurring", { method: "POST", body: JSON.stringify(template) });
}

export function updateRecurring(id, template) {
  logger.info("recurring", `updateRecurring: ${id}`);
  return authRequest(`/api/recurring/${id}`, { method: "PUT", body: JSON.stringify(template) });
}

export function deactivateRecurring(id) {
  logger.warn("recurring", `deactivateRecurring: ${id}`);
  return authRequest(`/api/recurring/${id}/deactivate`, { method: "DELETE" });
}

export function reactivateRecurring(id) {
  logger.info("recurring", `reactivateRecurring: ${id}`);
  return authRequest(`/api/recurring/${id}/reactivate`, { method: "POST" });
}

export function deleteRecurring(id) {
  logger.warn("recurring", `deleteRecurring: ${id}`);
  return authRequest(`/api/recurring/${id}`, { method: "DELETE" });
}
