import { authRequest } from "./auth.js";
import { logger } from "../utils/logger.js";

export function listRecurring() {
  logger.info("recurring", "listRecurring");
  return authRequest("/api/recurring");
}

export function createRecurring(template) {
  logger.info("recurring", "createRecurring", { frequency: template.frequency });
  return authRequest("/api/recurring", { method: "POST", body: JSON.stringify(template) });
}

export function deactivateRecurring(id) {
  logger.warn("recurring", `deactivateRecurring: ${id}`);
  return authRequest(`/api/recurring/${id}/deactivate`, { method: "DELETE" });
}

export function deleteRecurring(id) {
  logger.warn("recurring", `deleteRecurring: ${id}`);
  return authRequest(`/api/recurring/${id}`, { method: "DELETE" });
}
