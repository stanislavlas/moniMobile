import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_SERVER_URL = "budget_server_url";
const DEFAULT_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://api.homeassistant-las.work:8080";

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
