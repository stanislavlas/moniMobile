// mobile/src/services/currencies.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUrl } from "./serverUrl.js";

const CACHE_KEY    = "budget_currencies";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchCurrencies() {
  // Try cache first
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, fetchedAt } = JSON.parse(raw);
      if (Date.now() - fetchedAt < CACHE_TTL_MS) return data;
    }
  } catch {}

  // Fetch from backend (no auth required)
  const API_BASE = await getServerUrl();
  const res = await fetch(`${API_BASE}/api/currencies`);
  if (!res.ok) throw new Error(`Failed to fetch currencies: ${res.status}`);
  const data = await res.json();

  // Persist to cache
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {}

  return data; // { "AUD": "Australian Dollar", ... }
}
