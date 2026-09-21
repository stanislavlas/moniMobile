/**
 * Returns true for errors that should be queued and retried:
 * - Network-level failures (device offline, DNS, TCP, timeout)
 * - Server errors (5xx) — backend temporarily unavailable
 * - 408 Request Timeout, 429 Too Many Requests
 *
 * Excluded: auth errors (401), client errors (other 4xx).
 */
export function isRetryableError(error) {
  if (error.status >= 500 && error.status <= 599) return true;
  if (error.status === 408 || error.status === 429) return true;
  const msg = error.message || "";
  return (
    msg.includes("Network request failed") ||
    msg.includes("network request failed") ||
    msg.includes("timeout") ||
    msg.includes("Failed to fetch") ||
    error.code === "NETWORK_REQUEST_FAILED"
  );
}
