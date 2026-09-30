/**
 * useServerUrl
 * ------------
 * Encapsulates loading and saving the server URL preference from AsyncStorage.
 * Used by both AuthScreen and AccountScreen to avoid duplicating the pattern.
 */
import { useState, useEffect } from "react";
import { getServerUrl, setServerUrl } from "../services/serverUrl.js";

export function useServerUrl() {
  const [serverUrl,      setServerUrlState] = useState("");
  const [serverUrlDraft, setServerUrlDraft] = useState("");

  useEffect(() => {
    getServerUrl().then(url => { setServerUrlState(url); setServerUrlDraft(url); });
  }, []);

  async function saveServerUrl(draft) {
    await setServerUrl(draft);
    setServerUrlState(draft);
  }

  return { serverUrl, serverUrlDraft, setServerUrlDraft, saveServerUrl };
}
