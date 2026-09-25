import { useState, useEffect, useCallback, useRef } from "react";
import {
  getStoredUser, getAccessToken,
  login as apiLogin, register as apiRegister,
  logout as apiLogout, deleteAccount as apiDeleteAccount,
  changePassword as apiChangePassword,
  loginWithBiometric as apiLoginWithBiometric,
  storeBiometricCredentials,
  updateProfile as apiUpdateProfile,
  verifyRegistration as apiVerifyRegistration,
  resendVerificationCode as apiResendVerificationCode,
} from "../services/auth.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearEntriesCache } from "./useEntries.js";
import { clearHouseholdCache } from "./useHousehold.js";
import { isBiometricSupported, hasBiometricEnrolled, isBiometricEnabled, enableBiometric, authenticateWithBiometric } from "../services/biometric.js";

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [ready, setReady]     = useState(false); // true once AsyncStorage is checked
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  // Set after a successful login when device supports biometrics but enroll hasn't happened yet
  const [pendingBiometricEnroll, setPendingBiometricEnroll] = useState(null); // { email, password } | null
  // Set after a successful registration, waiting for email verification
  const [pendingRegistration, setPendingRegistration] = useState(null); // { email, password } | null
  const biometricTriggeredRef = useRef(false); // prevent double-trigger

  // Attempt biometric login automatically — called on app start and after logout
  const triggerBiometricLogin = useCallback(async () => {
    if (biometricTriggeredRef.current) return;
    try {
      const canUse = await isBiometricEnabled();
      if (!canUse) return;
      const supported = await isBiometricSupported();
      const enrolled  = await hasBiometricEnrolled();
      if (!supported || !enrolled) return;

      biometricTriggeredRef.current = true;
      setLoading(true); setError(null);
      try {
        const authenticated = await authenticateWithBiometric();
        if (authenticated) {
          const u = await apiLoginWithBiometric();
          setUser(u);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    } catch {
      // Non-critical — ignore
    }
  }, []);

  // Rehydrate session from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const [storedUser, token] = await Promise.all([getStoredUser(), getAccessToken()]);
      if (storedUser && token) {
        setUser(storedUser);
        setReady(true);
      } else {
        setReady(true);
        await triggerBiometricLogin();
      }
    })();
  }, []);

  // Re-trigger biometric auto-login whenever the user is signed out (logout or session expiry)
  // but only after the initial rehydration is done (ready = true).
  // undefined = "effect hasn't run yet"; null/object = after first run
  const prevUserRef = useRef(undefined);
  useEffect(() => {
    if (!ready) return;
    const prev = prevUserRef.current;
    prevUserRef.current = user;
    // Only trigger if user transitioned from non-null → null (sign-out), not on first render
    if (prev !== undefined && prev !== null && user === null) {
      triggerBiometricLogin();
    }
  }, [user, ready, triggerBiometricLogin]);

  const isAuthenticated = !!(user);
  const clearError = () => setError(null);

  // After a successful password login, store credentials for biometric use.
  // - If biometrics are already enabled: silently refresh the stored credentials
  //   (handles the case where they were cleared by a previous bug).
  // - If biometrics are supported but not yet enabled: set pendingBiometricEnroll
  //   so the UI can prompt the user to opt in.
  async function handlePostLoginBiometric(email, password) {
    try {
      const [supported, enrolled, alreadyEnabled] = await Promise.all([
        isBiometricSupported(),
        hasBiometricEnrolled(),
        isBiometricEnabled(),
      ]);
      if (!supported || !enrolled) return;

      if (alreadyEnabled) {
        // Silently keep credentials fresh — no prompt needed
        await storeBiometricCredentials(email, password);
      } else {
        // Device supports biometrics but user hasn't opted in yet — prompt them
        setPendingBiometricEnroll({ email, password });
      }
    } catch {
      // Non-critical — ignore
    }
  }

  // Clear cached data when a different user logs in (e.g. new account on same device).
  // Clears if there is no stored user (previous session was logged out and KEY_USER
  // was removed) or if the stored user ID differs from the incoming one.
  // Biometric re-login for the same user (matching userId) skips the clear.
  async function clearCacheIfUserChanged(incomingUser) {
    try {
      const previous = await getStoredUser();
      const userChanged = !previous || previous.userId !== incomingUser.userId;
      if (userChanged) {
        await clearEntriesCache();
        await clearHouseholdCache();
      }
    } catch {
      // Non-critical — ignore
    }
  }

  const login = useCallback(async (credentials) => {
    setLoading(true); setError(null);
    try {
      const u = await apiLogin(credentials);
      await clearCacheIfUserChanged(u);
      await handlePostLoginBiometric(credentials.email, credentials.password);
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data) => {
    setLoading(true); setError(null);
    try {
      const result = await apiRegister(data);
      // Registration now returns { pendingVerification: true, userId, message }
      // Store pending state so AuthScreen can show OTP entry
      setPendingRegistration({ email: data.email, password: data.password });
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyRegistration = useCallback(async (code) => {
    setLoading(true); setError(null);
    try {
      const u = await apiVerifyRegistration(code);
      await clearCacheIfUserChanged(u);
      if (pendingRegistration) {
        await handlePostLoginBiometric(pendingRegistration.email, pendingRegistration.password);
      }
      setPendingRegistration(null);
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [pendingRegistration]);

  const resendRegistrationCode = useCallback(async () => {
    if (!pendingRegistration) return;
    setLoading(true); setError(null);
    try {
      await apiResendVerificationCode(pendingRegistration.email);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [pendingRegistration]);

  const cancelRegistrationVerification = useCallback(() => {
    setPendingRegistration(null);
    clearError();
  }, []);

  const loginWithBiometric = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const authenticated = await authenticateWithBiometric();
      if (!authenticated) { setError("Biometric authentication failed"); return; }
      const u = await apiLoginWithBiometric();
      await clearCacheIfUserChanged(u);
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Clear local state and caches immediately — backend call happens in background
    setUser(null);
    biometricTriggeredRef.current = false;
    await clearEntriesCache();
    await clearHouseholdCache();
    apiLogout().catch(() => {}); // fire and forget
  }, []);

  const deleteAccount = useCallback(async (password) => {
    setLoading(true); setError(null);
    try {
      await apiDeleteAccount(password);
      await clearEntriesCache();
      setUser(null);
    }
    catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  }, []);

  const changePassword = useCallback(async (passwords) => {
    setLoading(true); setError(null);
    try { await apiChangePassword(passwords); }
    catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  }, []);

  const updateProfile = useCallback(async (patch) => {
    setLoading(true); setError(null);
    try {
      const updated = await apiUpdateProfile(patch);
      setUser(updated);
      return updated;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Confirm biometric enrollment from the UI prompt
  const confirmBiometricEnroll = useCallback(async () => {
    if (!pendingBiometricEnroll) return;
    try {
      await enableBiometric(pendingBiometricEnroll.email);
      await storeBiometricCredentials(pendingBiometricEnroll.email, pendingBiometricEnroll.password);
    } finally {
      setPendingBiometricEnroll(null);
    }
  }, [pendingBiometricEnroll]);

  const dismissBiometricEnroll = useCallback(() => {
    setPendingBiometricEnroll(null);
  }, []);

  // Called by authRequest when a 401 slips through
  const handleSessionExpired = useCallback(() => {
    setUser(null);
  }, []);

  return {
    user, isAuthenticated, ready, loading, error, clearError,
    login, register, logout, deleteAccount, changePassword, updateProfile,
    handleSessionExpired, loginWithBiometric,
    pendingBiometricEnroll, confirmBiometricEnroll, dismissBiometricEnroll,
    pendingRegistration, verifyRegistration, resendRegistrationCode, cancelRegistrationVerification,
  };
}
