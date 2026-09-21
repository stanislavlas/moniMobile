import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { canUseBiometric } from "../../src/services/biometric.js";
import { logger } from "../../src/utils/logger.js";
import { getServerUrl, setServerUrl, DEFAULT_URL } from "../../src/services/serverUrl.js";
import { CurrencyPicker } from "../../src/components/CurrencyPicker.jsx";
import { PasswordInput } from "../../src/components/PasswordInput.jsx";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";
import { useKeyboardPadding } from "../../src/hooks/useKeyboardPadding.js";
import { forgotPassword as apiForgotPassword, resetPassword as apiResetPassword } from "../../src/services/auth.js";

export function AuthScreen({ onLogin, onRegister, loading, error, onClearError, onBiometricLogin, currencyList = [], pendingRegistration, onVerifyRegistration, onResendRegistrationCode, onCancelRegistration }) {
  const { colors: C, styles: S } = useTheme();
  const keyboardPadding = useKeyboardPadding();
  const [mode, setMode]           = useState("login"); // "login" | "register" | "forgot" | "reset"
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [localError, setLocalError] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [serverUrlDraft, setServerUrlDraft] = useState("");
  const [serverUrl, setServerUrlState] = useState("");
  const [currency, setCurrency]                     = useState("EUR");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [otpCode, setOtpCode]     = useState("");
  // Forgot password state
  const [resetCode, setResetCode]       = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);

  const displayError = localError || error;
  const isLoading = loading || localLoading;

  useEffect(() => {
    canUseBiometric().then(setBiometricAvailable);
    getServerUrl().then(url => { setServerUrlState(url); setServerUrlDraft(url); });
  }, []);

  function switchMode(m) {
    setMode(m);
    setLocalError(null);
    setResetCodeSent(false);
    setResetCode("");
    setNewPassword("");
    setConfirmNewPw("");
    onClearError?.();
  }

  async function handleSaveServerUrl() {
    if (!serverUrlDraft.startsWith("http")) {
      setLocalError("URL must start with http:// or https://");
      return;
    }
    await setServerUrl(serverUrlDraft);
    setServerUrlState(serverUrlDraft);
    setShowServerUrl(false);
  }

  async function handleSubmit() {
    setLocalError(null); onClearError?.();

    if (mode === "register") {
      if (!name.trim())         return setLocalError("Name is required.");
      if (!email.includes("@")) return setLocalError("Enter a valid email.");
      if (password.length < 8)  return setLocalError("Password must be at least 8 characters.");
      if (password !== confirm)  return setLocalError("Passwords do not match.");
      try {
        await onRegister({ name: name.trim(), email: email.trim().toLowerCase(), password, currency });
      } catch (err) {
        logger.error('ui', 'onRegister failed', err.message);
      }
    } else {
      if (!email || !password) return setLocalError("Email and password are required.");
      try {
        await onLogin({ email: email.trim().toLowerCase(), password });
      } catch (err) {
        logger.error('ui', 'onLogin failed', err.message);
      }
    }
  }

  async function handleForgotPassword() {
    setLocalError(null);
    if (!email.includes("@")) return setLocalError("Enter a valid email address.");
    setLocalLoading(true);
    try {
      await apiForgotPassword(email.trim().toLowerCase());
      setResetCodeSent(true);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLocalLoading(false);
    }
  }

  async function handleResetPassword() {
    setLocalError(null);
    if (!resetCode.trim()) return setLocalError("Enter the verification code.");
    if (newPassword.length < 8) return setLocalError("New password must be at least 8 characters.");
    if (newPassword !== confirmNewPw) return setLocalError("Passwords do not match.");
    setLocalLoading(true);
    try {
      await apiResetPassword(resetCode.trim(), newPassword);
      switchMode("login");
      setLocalError(null);
      setEmail(email);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLocalLoading(false);
    }
  }

  return (
    <ScrollView
      style={S.screen}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 24 + keyboardPadding }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Registration OTP verification ── */}
      {pendingRegistration ? (
        <>
          <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>📧</Text>
          <Text style={[S.h1, { textAlign: "center", marginBottom: 4 }]}>Verify your email</Text>
          <Text style={[S.small, { textAlign: "center", marginBottom: 16, color: C.textSecondary }]}>
            Contact your administrator to get the verification code, then enter it below to activate your account.
          </Text>

          <FeedbackBanner feedback={displayError ? { ok: false, msg: displayError } : null} />

          <Text style={[S.label, { marginBottom: 6 }]}>Verification code</Text>
          <TextInput
            style={[S.input, { letterSpacing: 8, fontSize: 20, textAlign: "center" }]}
            placeholder="000000"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholderTextColor={C.textTertiary}
            autoFocus
          />

          <TouchableOpacity
            style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 12 }]}
            onPress={async () => {
              setLocalError(null); onClearError?.();
              try { await onVerifyRegistration(otpCode.trim()); }
              catch (err) { setLocalError(err.message); }
            }}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Verify email</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              setLocalError(null); onClearError?.();
              try { await onResendRegistrationCode?.(); }
              catch (err) { setLocalError(err.message); }
            }}
            style={{ marginTop: 16, alignItems: "center" }}
            disabled={isLoading}
          >
            <Text style={{ fontSize: 14, color: C.green }}>Resend code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setOtpCode(""); onClearError?.(); setLocalError(null); onCancelRegistration?.(); }}
            style={{ marginTop: 12, alignItems: "center" }}
          >
            <Text style={{ fontSize: 13, color: C.textTertiary }}>Back to register</Text>
          </TouchableOpacity>
        </>

      ) : mode === "forgot" ? (
        /* ── Forgot / Reset password ── */
        <>
          <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🔑</Text>
          <Text style={[S.h1, { textAlign: "center", marginBottom: 4 }]}>Reset password</Text>

          {!resetCodeSent ? (
            <>
              <Text style={[S.small, { textAlign: "center", marginBottom: 32, color: C.textSecondary }]}>
                Enter your email and a reset code will be generated. Contact your administrator to get the code.
              </Text>

              <FeedbackBanner feedback={displayError ? { ok: false, msg: displayError } : null} />

              <Text style={[S.label, { marginBottom: 6 }]}>Email</Text>
              <TextInput
                style={S.input}
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={C.textTertiary}
              />

              <TouchableOpacity
                style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 12 }]}
                onPress={handleForgotPassword}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Request reset code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[S.small, { textAlign: "center", marginBottom: 16, color: C.textSecondary }]}>
                Contact your administrator to get the reset code for {email}, then set your new password below.
              </Text>

              <FeedbackBanner feedback={displayError ? { ok: false, msg: displayError } : null} />

              <Text style={[S.label, { marginBottom: 6 }]}>Reset code</Text>
              <TextInput
                style={[S.input, { letterSpacing: 8, fontSize: 20, textAlign: "center" }]}
                placeholder="000000"
                value={resetCode}
                onChangeText={setResetCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor={C.textTertiary}
                autoFocus
              />

              <Text style={[S.label, { marginBottom: 6, marginTop: 12 }]}>New password</Text>
              <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="Min. 8 characters" />

              <Text style={[S.label, { marginBottom: 6, marginTop: 10 }]}>Confirm new password</Text>
              <PasswordInput value={confirmNewPw} onChangeText={setConfirmNewPw} placeholder="Repeat password" />

              <TouchableOpacity
                style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 12 }]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Set new password</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => switchMode("login")} style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: C.textTertiary }}>Back to sign in</Text>
          </TouchableOpacity>
        </>

      ) : (
        /* ── Login / Register ── */
        <>
          <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>💰</Text>
          <Text style={[S.h1, { textAlign: "center", marginBottom: 4 }]}>Budget</Text>
          <Text style={[S.small, { textAlign: "center", marginBottom: 40 }]}>Personal finance tracker</Text>

          {/* Tab toggle */}
          <View style={{ flexDirection: "row", backgroundColor: C.bgSecondary, borderRadius: 10, padding: 4, marginBottom: 20 }}>
            {["login", "register"].map(m => (
              <TouchableOpacity
                key={m}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  alignItems: "center",
                  borderRadius: 8,
                  backgroundColor: mode === m ? C.bg : "transparent",
                  shadowColor: mode === m ? "#000" : "transparent",
                  shadowOpacity: mode === m ? 0.08 : 0,
                  shadowRadius: mode === m ? 3 : 0,
                  shadowOffset: mode === m ? { width: 0, height: 1 } : { width: 0, height: 0 },
                }}
                onPress={() => switchMode(m)}
              >
                <Text style={{ fontSize: 14, fontWeight: mode === m ? "600" : "400", color: mode === m ? C.text : C.textTertiary }}>
                  {m === "login" ? "Sign in" : "Register"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FeedbackBanner feedback={displayError ? { ok: false, msg: displayError } : null} />

          {mode === "register" && (
            <>
              <Text style={[S.label, { marginBottom: 6 }]}>Full name</Text>
              <TextInput
                style={S.input}
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                placeholderTextColor={C.textTertiary}
              />
            </>
          )}

          <Text style={[S.label, { marginBottom: 6 }]}>Email</Text>
          <TextInput
            style={S.input}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={C.textTertiary}
          />

          <Text style={[S.label, { marginBottom: 6 }]}>Password</Text>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
          />

          {mode === "register" && (
            <>
              <Text style={[S.label, { marginBottom: 6 }]}>Confirm password</Text>
              <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Repeat password" />

              <Text style={[S.label, { marginBottom: 6 }]}>Currency</Text>
              <TouchableOpacity
                style={[S.input, { justifyContent: "center" }]}
                onPress={() => setShowCurrencyPicker(true)}
              >
                <Text style={{ color: C.text }}>
                  {currency}{currencyList.find(c => c.code === currency) ? ` — ${currencyList.find(c => c.code === currency).name}` : ""}
                </Text>
              </TouchableOpacity>
              <CurrencyPicker
                visible={showCurrencyPicker}
                selected={currency}
                currencyList={currencyList}
                onSelect={setCurrency}
                onClose={() => setShowCurrencyPicker(false)}
              />
            </>
          )}

          <TouchableOpacity
            style={[S.btnPrimary, { backgroundColor: C.green }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={S.btnPrimaryText}>{mode === "login" ? "Sign in" : "Create account"}</Text>
            }
          </TouchableOpacity>

          {mode === "login" && (
            <TouchableOpacity onPress={() => switchMode("forgot")} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: C.green }}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {mode === "login" && biometricAvailable && (
            <TouchableOpacity
              style={{ marginTop: 12, paddingVertical: 12, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSecondary }}
              onPress={onBiometricLogin}
              disabled={isLoading}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>🔐</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>Sign in with Biometrics</Text>
              </View>
            </TouchableOpacity>
          )}

          <Text style={[S.small, { textAlign: "center", marginTop: 24, color: C.textTertiary }]}>
            Your data is stored privately in AWS DynamoDB.
          </Text>

          {/* Server URL — collapsed by default */}
          <TouchableOpacity onPress={() => setShowServerUrl(v => !v)} style={{ marginTop: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: C.textTertiary }}>⚙ Server: {serverUrl}</Text>
          </TouchableOpacity>
          {showServerUrl && (
            <View style={{ marginTop: 10 }}>
              <Text style={[S.label, { marginBottom: 6 }]}>Backend URL</Text>
              <TextInput
                style={S.input}
                value={serverUrlDraft}
                onChangeText={setServerUrlDraft}
                placeholder={DEFAULT_URL}
                placeholderTextColor={C.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={handleSaveServerUrl}>
                <Text style={S.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
