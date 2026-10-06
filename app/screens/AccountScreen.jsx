import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Switch, Alert, BackHandler,
} from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import {
  isBiometricSupported,
  hasBiometricEnrolled,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  authenticateWithBiometric,
} from "../../src/services/biometric.js";
import { storeBiometricCredentials, clearBiometricCredentials } from "../../src/services/auth.js";
import { DEFAULT_URL } from "../../src/services/serverUrl.js";
import { useServerUrl } from "../../src/hooks/useServerUrl.js";
import { requestNotificationPermission } from "../../src/services/notifications.js";
import { useFeedback } from "../../src/hooks/useFeedback.js";
import { useCurrencies } from "../../src/hooks/useCurrencies.js";
import { ServerUrlEditor } from "../../src/components/ServerUrlEditor.jsx";
import { CategoriesScreen } from "./CategoriesScreen.jsx";
import { HouseholdScreen } from "./HouseholdScreen.jsx";
import { RecurringScreen } from "./RecurringScreen.jsx";
import { CurrencyPicker } from "../../src/components/CurrencyPicker.jsx";
import { PasswordInput } from "../../src/components/PasswordInput.jsx";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";
import { TimePicker } from "../../src/components/TimePicker.jsx";

const SECTION_LABEL = {
  fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, marginTop: 4,
};

export function AccountScreen({
  user,
  household,
  householdError,
  onLogout,
  onDeleteAccount,
  onChangePassword,
  incomeCategories,
  expenseCategories,
  investmentCategories = [],
  customCats,
  onCreateCategory,
  onDeleteCategory,
  onCreate,
  onInvite,
  onAcceptInvitation,
  onRejectInvitation,
  onCancelInvitation,
  onRemoveMember,
  onLeave,
  onDeleteHousehold,
  onRename,
  pendingInvitations = [],
  onUpdateProfile,
  colorMap,
}) {
  const { isDark, toggleTheme, colors: C, styles: S } = useTheme();
  const { currencyList, loading: currenciesLoading, load: loadCurrencies } = useCurrencies();
  const { feedback, flash } = useFeedback();

  // ── Accordion for mobile-only settings ───────────────────────────────────
  const [section, setSection] = useState(null); // "notifications" | "serverUrl" | "biometric"
  function toggleSection(name) { setSection(s => s === name ? null : name); }

  // ── Profile ───────────────────────────────────────────────────────────────
  const [nameDraft, setNameDraft]     = useState(user?.name  || "");
  const [emailDraft, setEmailDraft]   = useState(user?.email || "");
  const [profilePw, setProfilePw]     = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    setNameDraft(user?.name  || "");
    setEmailDraft(user?.email || "");
  }, [user?.name, user?.email]);

  async function handleSaveProfile() {
    const trimmedName  = nameDraft.trim();
    const trimmedEmail = emailDraft.trim().toLowerCase();
    if (!trimmedName)  return flash(false, "Name cannot be empty.");
    if (!trimmedEmail) return flash(false, "Email cannot be empty.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return flash(false, "Enter a valid email address.");
    const nameChanged  = trimmedName  !== user?.name;
    const emailChanged = trimmedEmail !== user?.email?.toLowerCase();
    if (!nameChanged && !emailChanged) return flash(true, "No changes to save.");
    if (emailChanged && !profilePw)    return flash(false, "Enter your password to change email.");
    setLoadingProfile(true);
    try {
      const patch = {};
      if (nameChanged)  patch.name  = trimmedName;
      if (emailChanged) { patch.email = trimmedEmail; patch.currentPassword = profilePw; }
      await onUpdateProfile(patch);
      flash(true, "Profile updated.");
      setProfilePw("");
    } catch (e) {
      flash(false, e.message || "Failed to update profile.");
    } finally {
      setLoadingProfile(false);
    }
  }

  // ── Currency ──────────────────────────────────────────────────────────────
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // ── Password ──────────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  async function handleChangePassword() {
    if (newPw.length < 8)    return flash(false, "New password must be at least 8 characters.");
    if (newPw !== confirmPw) return flash(false, "Passwords do not match.");
    setLoadingPassword(true);
    try {
      await onChangePassword({ currentPassword: currentPw, newPassword: newPw });
      flash(true, "Password changed.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      flash(false, e.message);
    } finally {
      setLoadingPassword(false);
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  const [deletePw, setDeletePw]     = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);

  async function handleDelete() {
    if (!deletePw) return flash(false, "Enter your password to confirm.");
    setLoadingDelete(true);
    try { await onDeleteAccount(deletePw); }
    catch (e) { flash(false, e.message); }
    finally { setLoadingDelete(false); }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifEnabled, setNotifEnabled]       = useState(user?.notificationsEnabled ?? false);
  const [notifFrequency, setNotifFrequency]   = useState(user?.notificationFrequency ?? "daily");
  const [notifCustomDays, setNotifCustomDays] = useState(String(user?.notificationCustomDays ?? 1));
  const [notifTime, setNotifTime]             = useState(user?.notificationTime ?? "20:00");
  const [showTimePicker, setShowTimePicker]   = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  async function handleSaveNotifications() {
    const customDaysNum = parseInt(notifCustomDays, 10);
    if (notifFrequency === "custom" && (isNaN(customDaysNum) || customDaysNum < 1)) {
      return flash(false, "Custom days must be a number ≥ 1.");
    }
    if (notifEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return flash(false, "Could not get notification permission.");
    }
    setLoadingNotifications(true);
    try {
      await onUpdateProfile({
        notificationsEnabled:   notifEnabled,
        notificationFrequency:  notifFrequency,
        notificationCustomDays: notifFrequency === "custom" ? customDaysNum : (user?.notificationCustomDays ?? 1),
        notificationTime:       notifTime,
      });
      flash(true, notifEnabled ? "Notifications scheduled." : "Notifications disabled.");
      setSection(null);
    } catch (e) {
      flash(false, e.message || "Failed to save notification settings.");
    } finally {
      setLoadingNotifications(false);
    }
  }

  // ── Server URL ────────────────────────────────────────────────────────────
  const { serverUrl, serverUrlDraft, setServerUrlDraft, saveServerUrl } = useServerUrl();

  async function handleSaveServerUrl() {
    if (!serverUrlDraft.startsWith("http")) return flash(false, "URL must start with http:// or https://");
    await saveServerUrl(serverUrlDraft);
    setSection(null);
    flash(true, "Server URL saved. Restart the app to apply.");
  }

  // ── Biometric ─────────────────────────────────────────────────────────────
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled]   = useState(false);
  const [biometricEnabled, setBiometricEnabled]     = useState(false);
  const [biometricPassword, setBiometricPassword]   = useState("");
  const [loadingBiometric, setLoadingBiometric]     = useState(false);
  const biometricName = "Biometrics";

  useEffect(() => {
    (async () => {
      const [supported, enrolled, enabled] = await Promise.all([
        isBiometricSupported(), hasBiometricEnrolled(), isBiometricEnabled(),
      ]);
      setBiometricSupported(supported);
      setBiometricEnrolled(enrolled);
      setBiometricEnabled(enabled);
    })();
  }, []);

  async function handleBiometricToggle(enable) {
    if (enable) {
      if (section !== "biometric") { setSection("biometric"); return; }
      if (!biometricPassword) return flash(false, "Enter your password to enable biometric login.");
      setLoadingBiometric(true);
      try {
        const authenticated = await authenticateWithBiometric();
        if (!authenticated) { flash(false, "Biometric authentication failed."); return; }
        await storeBiometricCredentials(user.email, biometricPassword);
        await enableBiometric(user.email);
        setBiometricEnabled(true);
        setBiometricPassword("");
        setSection(null);
        flash(true, `${biometricName} login enabled.`);
      } catch (e) {
        flash(false, e.message || "Failed to enable biometric login.");
      } finally {
        setLoadingBiometric(false);
      }
    } else {
      Alert.alert(`Disable ${biometricName}?`, "You'll need to enter your password to sign in.", [
        { text: "Cancel", style: "cancel" },
        { text: "Disable", style: "destructive", onPress: async () => {
          try {
            await disableBiometric();
            await clearBiometricCredentials();
            setBiometricEnabled(false);
            flash(true, `${biometricName} login disabled.`);
          } catch (e) { flash(false, e.message || "Failed to disable biometric login."); }
        }},
      ]);
    }
  }

  // ── Tab strip ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("profile");

  const TABS = [
    { id: "profile",    label: "Profile"    },
    { id: "categories", label: "Categories" },
    { id: "household",  label: "Household"  },
    { id: "recurring",  label: "Recurring"  },
  ];

  // ── Hardware back button — return to Profile tab if not already there ─────
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab !== "profile") { setTab("profile"); return true; }
      return false;
    });
    return () => handler.remove();
  }, [tab]);

  // ── Main account view ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>

      {/* ── Tab strip (fixed above ScrollView) ───────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, backgroundColor: C.bg }}>
        <Text style={[S.h2, { marginBottom: 12 }]}>Account</Text>
        <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border }}>
          {TABS.map(t => {
            const isActive = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? C.green : "transparent",
                  marginBottom: -0.5,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: isActive ? "700" : "400",
                  color: isActive ? C.green : C.textSecondary,
                }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Tab content ──────────────────────────────────────────────────── */}

      {/* Categories tab */}
      {tab === "categories" && (
        <CategoriesScreen
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          investmentCategories={investmentCategories}
          customCats={customCats}
          onCreateCategory={onCreateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      )}

      {/* Household tab */}
      {tab === "household" && (
        <HouseholdScreen
          household={household}
          user={user}
          onCreate={onCreate}
          onInvite={onInvite}
          onCancelInvitation={onCancelInvitation}
          onRemoveMember={onRemoveMember}
          onLeave={onLeave}
          onDelete={onDeleteHousehold}
          onRename={onRename}
          autoOpenInvite={false}
        />
      )}

      {/* Recurring tab */}
      {tab === "recurring" && (
        <RecurringScreen
          user={user}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          investmentCategories={investmentCategories}
          colorMap={colorMap}
          onCurrencyPickerOpen={loadCurrencies}
        />
      )}

      {/* Profile tab */}
      {tab === "profile" && (
      <ScrollView
        style={S.screen}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* Household fetch error */}
        {householdError && (
          <View style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: C.redLight, borderWidth: 0.5, borderColor: C.redBorder }}>
            <Text style={{ fontSize: 13, color: C.redDark }}>Could not load household data: {String(householdError)}</Text>
          </View>
        )}

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={[S.label, { marginBottom: 8 }]}>Pending invitations</Text>
            {pendingInvitations.map(inv => (
              <View key={inv.invitationId}
                style={[S.card, { marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[S.body, { fontWeight: "600" }]}>{inv.householdName}</Text>
                  <Text style={S.small}>Invited by {inv.invitedByName}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.green }}
                    onPress={async () => { try { await onAcceptInvitation(inv.invitationId); } catch (e) { flash(false, e.message); } }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bgSecondary }}
                    onPress={async () => { try { await onRejectInvitation(inv.invitationId); } catch (e) { flash(false, e.message); } }}>
                    <Text style={{ fontSize: 13, color: C.textSecondary }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Avatar + name card ──────────────────────────────────────────── */}
        <View style={[S.card, { marginBottom: 20, alignItems: "center", paddingVertical: 20 }]}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenLight, justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: C.greenDark }}>{user?.name?.charAt(0)?.toUpperCase() || "?"}</Text>
          </View>
          <Text style={[S.h3, { marginBottom: 2 }]}>{user?.name}</Text>
          <Text style={S.small}>{user?.email}</Text>
          {household && (
            <Text style={{ fontSize: 12, color: C.greenDark, marginTop: 4 }}>
              🏠 {household.name} · {user?.householdRole === "OWNER" ? "Owner" : "Member"}
            </Text>
          )}
        </View>

        {/* ── Personal info ───────────────────────────────────────────────── */}
        <Text style={[SECTION_LABEL, { color: C.textTertiary }]}>Personal info</Text>
        <View style={[S.card, { marginBottom: 20 }]}>
          <Text style={[S.label, { marginBottom: 5 }]}>Name</Text>
          <TextInput
            style={S.input}
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Your name"
            placeholderTextColor={C.textTertiary}
            autoCapitalize="words"
          />
          <Text style={[S.label, { marginBottom: 5 }]}>Email</Text>
          <TextInput
            style={S.input}
            value={emailDraft}
            onChangeText={setEmailDraft}
            placeholder="your@email.com"
            placeholderTextColor={C.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {emailDraft.trim().toLowerCase() !== user?.email?.toLowerCase() && (
            <>
              <Text style={[S.label, { marginBottom: 5 }]}>Confirm with your password</Text>
              <PasswordInput value={profilePw} onChangeText={setProfilePw} />
            </>
          )}
          <TouchableOpacity
            style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 4 }]}
            onPress={handleSaveProfile}
            disabled={loadingProfile}
          >
            {loadingProfile ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Save changes</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Display currency ────────────────────────────────────────────── */}
        <Text style={[SECTION_LABEL, { color: C.textTertiary }]}>Display currency</Text>
        <View style={[S.card, { marginBottom: 20 }]}>
          <Text style={[S.small, { marginBottom: 12 }]}>Stored in original currency, converted on display.</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.bgSecondary, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12 }}
            onPress={() => { loadCurrencies(); setShowCurrencyPicker(true); }}
          >
            <Text style={{ fontSize: 15, color: C.text }}>{user?.currency ?? "EUR"}</Text>
            <Text style={{ fontSize: 14, color: C.green, fontWeight: "600" }}>Change →</Text>
          </TouchableOpacity>
          <CurrencyPicker
            visible={showCurrencyPicker}
            selected={user?.currency}
            currencyList={currencyList}
            loading={currenciesLoading}
            onSelect={async (code) => {
              setShowCurrencyPicker(false);
              if (code === user?.currency) return;
              try {
                await onUpdateProfile({ currency: code });
                flash(true, `Currency changed to ${code}`);
              } catch (e) { flash(false, e.message || "Failed to update currency"); }
            }}
            onClose={() => setShowCurrencyPicker(false)}
          />
        </View>

        {/* ── Change password ─────────────────────────────────────────────── */}
        <Text style={[SECTION_LABEL, { color: C.textTertiary }]}>Change password</Text>
        <View style={[S.card, { marginBottom: 20 }]}>
          {[
            ["Current password", currentPw, setCurrentPw],
            ["New password",     newPw,      setNewPw],
            ["Confirm new password", confirmPw, setConfirmPw],
          ].map(([lbl, val, set]) => (
            <View key={lbl}>
              <Text style={[S.label, { marginBottom: 5 }]}>{lbl}</Text>
              <PasswordInput value={val} onChangeText={set} />
            </View>
          ))}
          <TouchableOpacity
            style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 4 }]}
            onPress={handleChangePassword}
            disabled={loadingPassword}
          >
            {loadingPassword ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Change password</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Appearance + Settings ────────────────────────────────────────── */}
        <Text style={[SECTION_LABEL, { color: C.textTertiary }]}>Settings</Text>

        {/* Dark mode */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <View style={S.rowBetween}>
            <View style={S.row}>
              <Text style={{ fontSize: 18, marginRight: 12 }}>{isDark ? "🌙" : "☀️"}</Text>
              <Text style={S.body}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: C.bgTertiary, true: C.greenLight }}
              thumbColor={isDark ? C.green : C.textTertiary}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <TouchableOpacity style={S.rowBetween} onPress={() => toggleSection("notifications")}>
            <View style={S.row}>
              <Text style={{ fontSize: 18, marginRight: 12 }}>🔔</Text>
              <Text style={S.body}>Expense Reminders</Text>
            </View>
            <View style={S.row}>
              {notifEnabled && section !== "notifications" && (
                <Text style={{ fontSize: 11, color: C.greenDark, marginRight: 8, fontWeight: "600" }}>ON</Text>
              )}
              <Text style={{ color: C.textTertiary, fontSize: 18 }}>{section === "notifications" ? "−" : "+"}</Text>
            </View>
          </TouchableOpacity>
          <Text style={[S.small, { marginLeft: 30, marginTop: 4 }]}>
            {notifEnabled ? `Reminders enabled · ${notifFrequency} at ${notifTime}` : "Remind yourself to log expenses"}
          </Text>
          {section === "notifications" && (
            <View style={{ marginTop: 14 }}>
              <View style={[S.rowBetween, { marginBottom: 16 }]}>
                <Text style={S.label}>Enable reminders</Text>
                <Switch
                  value={notifEnabled}
                  onValueChange={setNotifEnabled}
                  trackColor={{ false: C.bgTertiary, true: C.greenLight }}
                  thumbColor={notifEnabled ? C.green : C.textTertiary}
                />
              </View>
              {notifEnabled && (
                <>
                  <Text style={[S.label, { marginBottom: 8 }]}>Frequency</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    {["daily", "weekly", "monthly", "custom"].map(freq => (
                      <TouchableOpacity
                        key={freq}
                        onPress={() => setNotifFrequency(freq)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1,
                          borderColor: notifFrequency === freq ? C.green : C.border,
                          backgroundColor: notifFrequency === freq ? C.greenLight : C.bg,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: notifFrequency === freq ? "700" : "400", color: notifFrequency === freq ? C.greenDark : C.text, textTransform: "capitalize" }}>
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {notifFrequency === "custom" && (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={[S.label, { marginBottom: 5 }]}>Every N days</Text>
                      <TextInput style={S.input} value={notifCustomDays} onChangeText={setNotifCustomDays} keyboardType="numeric" placeholder="e.g. 3" placeholderTextColor={C.textTertiary} />
                    </View>
                  )}
                  <Text style={[S.label, { marginBottom: 5 }]}>Reminder time</Text>
                  <TouchableOpacity
                    style={[S.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, color: C.text }}>{notifTime}</Text>
                    <Text style={{ fontSize: 16, color: C.textTertiary }}>🕐</Text>
                  </TouchableOpacity>
                  <TimePicker visible={showTimePicker} value={notifTime} onChange={t => { setNotifTime(t); setShowTimePicker(false); }} onClose={() => setShowTimePicker(false)} />
                </>
              )}
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 14 }]} onPress={handleSaveNotifications} disabled={loadingNotifications}>
                {loadingNotifications ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Server URL */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <TouchableOpacity style={S.rowBetween} onPress={() => toggleSection("serverUrl")}>
            <View style={S.row}>
              <Text style={{ fontSize: 18, marginRight: 12 }}>🌐</Text>
              <Text style={S.body}>Server URL</Text>
            </View>
            <Text style={{ color: C.textTertiary, fontSize: 18 }}>{section === "serverUrl" ? "−" : "+"}</Text>
          </TouchableOpacity>
          <ServerUrlEditor
            visible={section === "serverUrl"}
            draft={serverUrlDraft}
            onChangeDraft={setServerUrlDraft}
            onSave={handleSaveServerUrl}
            currentUrl={serverUrl}
            placeholder={DEFAULT_URL}
          />
        </View>

        {/* Biometric login */}
        {biometricSupported && biometricEnrolled && (
          <View style={[S.card, { marginBottom: 12 }]}>
            <TouchableOpacity style={S.rowBetween} onPress={() => !biometricEnabled && toggleSection("biometric")}>
              <View style={S.row}>
                <Text style={{ fontSize: 18, marginRight: 12 }}>🔐</Text>
                <Text style={S.body}>{biometricName} Login</Text>
              </View>
              {biometricEnabled
                ? <View onStartShouldSetResponder={() => true}>
                    <Switch value={true} onValueChange={handleBiometricToggle} trackColor={{ false: C.bgTertiary, true: C.greenLight }} thumbColor={C.green} />
                  </View>
                : <Text style={{ color: C.textTertiary, fontSize: 18 }}>{section === "biometric" ? "−" : "+"}</Text>
              }
            </TouchableOpacity>
            <Text style={[S.small, { marginLeft: 30, marginTop: 4, color: biometricEnabled ? C.greenDark : C.textSecondary }]}>
              {biometricEnabled ? `Enabled · Sign in securely with ${biometricName.toLowerCase()}` : `Sign in quickly with ${biometricName.toLowerCase()}`}
            </Text>
            {section === "biometric" && !biometricEnabled && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
                  Enter your password to enable {biometricName.toLowerCase()} login.
                </Text>
                <Text style={[S.label, { marginBottom: 5 }]}>Password</Text>
                <PasswordInput value={biometricPassword} onChangeText={setBiometricPassword} />
                <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={() => handleBiometricToggle(true)} disabled={loadingBiometric}>
                  {loadingBiometric ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Enable {biometricName}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={[S.card, { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center", marginTop: 8, marginBottom: 12 }]}
          onPress={onLogout}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
          <Text style={[S.body, { fontWeight: "600" }]}>Sign out</Text>
        </TouchableOpacity>

        {/* ── Delete account ───────────────────────────────────────────────── */}
        <Text style={[SECTION_LABEL, { color: C.red }]}>Danger zone</Text>
        <View style={[S.card, { borderColor: C.redBorder, marginBottom: 12 }]}>
          <Text style={{ fontSize: 13, color: C.redDark, marginBottom: 12 }}>
            This permanently deletes your account and all your data.
          </Text>
          <Text style={[S.label, { marginBottom: 5 }]}>Confirm with your password</Text>
          <PasswordInput value={deletePw} onChangeText={setDeletePw} />
          <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.red }]} onPress={handleDelete} disabled={loadingDelete}>
            {loadingDelete ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Permanently delete my account</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
      )}
      <FeedbackBanner feedback={feedback} />
    </View>
  );
}
