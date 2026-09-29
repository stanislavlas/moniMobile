import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_SERVER_URL = "moni_server_url";
// Fallback only used when EXPO_PUBLIC_API_BASE_URL is not set.
// Set this env variable in your .env file — do NOT rely on this hardcoded default in production.
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function getServerUrl() {
  try {
    const stored = await AsyncStorage.getItem(KEY_SERVER_URL);
    return stored || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export async function setServerUrl(url) {
  const trimmed = url.trim().replace(/\/$/, ""); // remove trailing slash
  await AsyncStorage.setItem(KEY_SERVER_URL, trimmed);
}

export { DEFAULT_URL };
