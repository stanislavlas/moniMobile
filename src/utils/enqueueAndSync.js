/**
 * Shared helper for offline-first write operations.
 *
 * Encapsulates the repeated pattern of:
 *   1. Dynamically importing syncService (avoids circular deps at module load)
 *   2. Getting the stored user to associate the operation with the correct userId
 *   3. Enqueuing the operation
 *   4. Triggering a background sync attempt
 *
 * Usage:
 *   import { enqueueAndSync } from "../utils/enqueueAndSync.js";
 *   await enqueueAndSync("entry.delete", { entryId });
 */
export async function enqueueAndSync(type, payload) {
  const { default: svc } = await import("../services/syncService.js");
  const { getStoredUser } = await import("../services/auth.js");
  const user = await getStoredUser();
  await svc.enqueue(type, payload, user?.userId);
  svc.syncAll().catch(() => {});
}
