/**
 * Auth Service — React Native / Expo
 * Uses AsyncStorage for tokens and SecureStore for biometric credentials.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { decode as base64Decode } from "base-64";
import { logger } from "../utils/logger.js";
import { getServerUrl } from "./serverUrl.js";

logger.auth('Auth Service initialized');
logger.auth('Platform: ' + require('react-native').Platform.OS);
const KEY_ACCESS          = "budget_access_token";
const KEY_REFRESH         = "budget_refresh_token";
const KEY_USER            = "budget_user";
export const KEY_BIOMETRIC_CREDENTIALS = "budget_biometric_credentials_secure";

export async function getAccessToken()  { return AsyncStorage.getItem(KEY_ACCESS); }
export async function getRefreshToken() { return AsyncStorage.getItem(KEY_REFRESH); }
export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(KEY_USER);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function storeTokens({ accessToken, refreshToken, user }) {
  await AsyncStorage.multiSet([
    [KEY_ACCESS,  accessToken],
    [KEY_REFRESH, refreshToken],
    [KEY_USER,    JSON.stringify(user)],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH, KEY_USER]);
}

function isExpired(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const p = JSON.parse(base64Decode(parts[1]));
    if (!p.exp || typeof p.exp !== 'number') return true;
    return Date.now() / 1000 > p.exp - 30;
  } catch { return true; }
}

export async function authRequest(path, options = {}, timeoutMs = 0) {
  let token = await getAccessToken();
  if (!token || isExpired(token)) {
    try {
      token = await refreshAccessToken();
    } catch (err) {
      if (err.code === "AUTH_EXPIRED") throw err;
      // Refresh failed due to a network error — surface as a network failure
      // rather than AUTH_EXPIRED so callers can queue the operation offline.
      if (
        err.name === "TypeError" ||
        err.name === "AbortError" ||
        (err.message && (
          err.message.includes("Network request failed") ||
          err.message.includes("Failed to fetch")
        ))
      ) {
        throw Object.assign(new Error("Network request failed"), { code: "NETWORK_REQUEST_FAILED" });
      }
      throw Object.assign(new Error("Session expired. Please log in again."), { code: "AUTH_EXPIRED" });
    }
  }

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const API_BASE = await getServerUrl();

  try {
    logger.api(`${options.method || 'GET'} ${API_BASE}${path}`);
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });

    if (res.status === 401) {
      await clearTokens();
      throw Object.assign(new Error("Session expired. Please log in again."), { code: "AUTH_EXPIRED" });
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || body.message || `API error ${res.status}`), { status: res.status });
    }
    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      // Timed out — treat same as a network failure so the caller can queue
      throw Object.assign(new Error("Network request failed"), { code: "NETWORK_REQUEST_FAILED" });
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function register({ name, email, password, currency }) {
  const API_BASE = await getServerUrl();
  const url = `${API_BASE}/api/auth/create`;
  const payload = { name, email, password, currency: currency || "EUR" };

  logger.section('REGISTER START');
  logger.api('Timestamp: ' + new Date().toISOString());
  logger.api('URL: ' + url);
  logger.api('Payload', { ...payload, password: '***' });

  try {
    logger.api('Starting fetch request...');
    const fetchStartTime = Date.now();

    // Add a timeout to detect hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.warn('api', 'Request timeout triggered (10s)');
      controller.abort();
    }, 10000); // 10 second timeout

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const fetchDuration = Date.now() - fetchStartTime;

    logger.api('Response received in: ' + fetchDuration + 'ms');
    logger.api('Response status: ' + res.status);

    const data = await res.json();

    if (!res.ok) {
      logger.error('api', 'Response not OK, throwing error');
      throw new Error(data.error || data.message || "Registration failed");
    }

    logger.section('REGISTER SUCCESS - pending verification');
    // Return the pending verification response so the UI can show OTP entry
    return data;
  } catch (error) {
    logger.section('REGISTER ERROR');
    logger.error('auth', 'Error caught: ' + error.name, error.message);

    if (error.name === 'AbortError') {
      logger.error('auth', 'Request was aborted (timeout)');
      throw new Error('Connection timeout - cannot reach server at ' + await getServerUrl());
    }

    if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
      logger.error('auth', 'Network request failed - check backend is running, IP/port is correct, and emulator network is configured');
    }

    throw error;
  }
}

export async function verifyRegistration(code) {
  const API_BASE = await getServerUrl();
  const res = await fetch(`${API_BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Verification failed");
  await storeTokens(data);
  return data.user;
}

export async function resendVerificationCode(email) {
  const API_BASE = await getServerUrl();
  const res = await fetch(`${API_BASE}/api/auth/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Failed to resend code");
  return data;
}

export async function forgotPassword(email) {
  const API_BASE = await getServerUrl();
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Failed to request password reset");
  return data;
}

export async function resetPassword(code, newPassword) {
  const API_BASE = await getServerUrl();
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Failed to reset password");
  return data;
}

export async function login({ email, password }) {
  const API_BASE = await getServerUrl();
  const url = `${API_BASE}/api/auth/login`;
  logger.section('LOGIN START');
  logger.api('Email: ' + email);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    await storeTokens(data);
    logger.section('LOGIN SUCCESS');
    return data.user;
  } catch (error) {
    clearTimeout(timeoutId);
    logger.section('LOGIN ERROR');
    logger.error('auth', error.name + ': ' + error.message);
    if (error.name === 'AbortError') throw new Error('Cannot reach server. Please check your connection.');
    throw error;
  }
}

export async function logout() {
  // Clear sync queue synchronously so pending ops don't leak to the next session
  try {
    const { default: syncService } = await import("./syncService.js");
    const queueStatus = await syncService.getQueueStatus();
    if (queueStatus.total > 0) {
      logger.warn('auth', `Clearing ${queueStatus.total} pending sync operations on logout`);
      await syncService.clearQueue();
    }
  } catch {}

  // Clear local tokens immediately — UI can proceed to login screen at once
  const refreshToken = await getRefreshToken();
  await clearTokens();

  // Tell the backend in the background — best-effort, ignore failures
  getServerUrl().then(API_BASE =>
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  );
}

/**
 * Validate (and if needed refresh) the access token before attempting a sync.
 * Returns { valid: true, token } on success.
 * Returns { valid: false, offline: true } when the server can't be reached — queue must NOT be cleared.
 * Returns { valid: false, authExpired: true } when the token is genuinely revoked/expired.
 */
export async function ensureValidTokenForSync() {
  let token = await getAccessToken();

  if (!token || isExpired(token)) {
    try {
      token = await refreshAccessToken();
      return { valid: true, token };
    } catch (err) {
      logger.warn('auth', 'Token refresh failed during sync check', err.message);
      // Network error — can't reach server, but the queue is still valid
      if (
        err.name === "AbortError" ||
        err.name === "TypeError" ||
        err.code === "NETWORK_REQUEST_FAILED" ||
        (err.message && (
          err.message.includes("Network request failed") ||
          err.message.includes("Failed to fetch") ||
          err.message.includes("timeout")
        ))
      ) {
        return { valid: false, offline: true };
      }
      // Genuine auth failure — token revoked or server rejected it
      return { valid: false, authExpired: true };
    }
  }

  return { valid: true, token };
}

export async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  const API_BASE = await getServerUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res  = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) { await clearTokens(); throw Object.assign(new Error("Session expired"), { code: "AUTH_EXPIRED" }); }
    await AsyncStorage.multiSet([
      [KEY_ACCESS,  data.accessToken],
      [KEY_REFRESH, data.refreshToken],
    ]);
    return data.accessToken;
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteAccount(password) {
  await authRequest("/api/auth/account", { method: "DELETE", body: JSON.stringify({ password }) });
  await clearTokens();
  await clearBiometricCredentials();
}

export async function updateProfile(patch) {
  // patch: { name?: string, currency?: string, email?: string, currentPassword?: string }
  const data = await authRequest("/api/user", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  // Merge and persist to AsyncStorage
  const existing = await getStoredUser();
  const updated = { ...existing, ...data };
  await AsyncStorage.setItem(KEY_USER, JSON.stringify(updated));
  return updated;
}

export async function changePassword({ currentPassword, newPassword }) {
  const result = await authRequest("/api/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) });
  // Stored biometric credentials contain the old password — clear them so the
  // user is prompted to re-enroll biometrics with the new password on next login.
  await clearBiometricCredentials();
  return result;
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates) {
  return authRequest("/api/auth/profile", { method: "PUT", body: JSON.stringify(updates) });
}

// --- Biometric-specific auth functions ---

/**
 * Store encrypted credentials for biometric login
 * Uses expo-secure-store for encrypted storage in iOS Keychain / Android Keystore
 */
export async function storeBiometricCredentials(email, password) {
  try {
    const credentials = JSON.stringify({ email, password });
    await SecureStore.setItemAsync(KEY_BIOMETRIC_CREDENTIALS, credentials, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    logger.error('auth', 'Failed to store biometric credentials', error);
    throw error;
  }
}

/**
 * Get stored biometric credentials from SecureStore
 */
export async function getBiometricCredentials() {
  try {
    const stored = await SecureStore.getItemAsync(KEY_BIOMETRIC_CREDENTIALS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    logger.error('auth', 'Failed to retrieve biometric credentials', error);
    return null;
  }
}

/**
 * Clear stored biometric credentials from SecureStore
 */
export async function clearBiometricCredentials() {
  try {
    await SecureStore.deleteItemAsync(KEY_BIOMETRIC_CREDENTIALS);
  } catch (error) {
    logger.error('auth', 'Failed to clear biometric credentials', error);
  }
}

/**
 * Login with biometric authentication — always does a real network call.
 */
export async function loginWithBiometric() {
  const credentials = await getBiometricCredentials();
  if (!credentials) {
    const { disableBiometric } = await import("./biometric.js");
    await disableBiometric();
    throw new Error("Biometric login is no longer set up. Please sign in with your password to re-enable it.");
  }
  return login(credentials);
}
