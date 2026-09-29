// mobile/src/services/currencies.js
import { getServerUrl } from "./serverUrl.js";

const FETCH_TIMEOUT_MS = 8000;

export async function fetchCurrencies() {
  const API_BASE = await getServerUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/currencies`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch currencies: ${res.status}`);
    return res.json(); // { "AUD": "Australian Dollar", ... }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Currencies request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
