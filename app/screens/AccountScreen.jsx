import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch, Alert, BackHandler, Platform } from "react-native";
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
import { ServerUrlEditor } from "../../src/components/ServerUrlEditor.jsx";
import { CategoriesScreen } from "./CategoriesScreen.jsx";
import { HouseholdScreen } from "./HouseholdScreen.jsx";
import { CurrencyPicker } from "../../src/components/CurrencyPicker.jsx";
import { PasswordInput } from "../../src/components/PasswordInput.jsx";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";
import { SubScreenHeader } from "../../src/components/SubScreenHeader.jsx";
import { NavCard } from "../../src/components/NavCard.jsx";
import { TimePicker } from "../../src/components/TimePicker.jsx";

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
  currencyList = [],
  currenciesLoading = false,
  onCurrencyPickerOpen,
}) {
  const { isDark, toggleTheme, colors: C, styles: S } = useTheme();
  const [view, setView]         = useState("account"); // "account" | "history" | "categories" | "household"
  const { feedback, flash }     = useFeedback();

  const [section, setSection]   = useState(null);
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [deletePw, setDeletePw]     = useState("");
  // Per-section loading states so that saving one section doesn't disable
  // buttons in all other sections simultaneously.
  const [loadingProfile,      setLoadingProfile]      = useState(false);
  const [loadingPassword,     setLoadingPassword]     = useState(false);
  const [loadingNotifications,setLoadingNotifications] = useState(false);
  const [loadingBiometric,    setLoadingBiometric]    = useState(false);
  const [loadingDelete,       setLoadingDelete]       = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Notification preferences
  const [notifEnabled, setNotifEnabled]       = useState(user?.notificationsEnabled ?? false);
  const [notifFrequency, setNotifFrequency]   = useState(user?.notificationFrequency ?? "daily");
  const [notifCustomDays, setNotifCustomDays] = useState(String(user?.notificationCustomDays ?? 1));
  const [notifTime, setNotifTime]             = useState(user?.notificationTime ?? "20:00");

  // Profile editing
  const [nameDraft, setNameDraft]   = useState(user?.name || "");
  const [emailDraft, setEmailDraft] = useState(user?.email || "");
  const [profilePw, setProfilePw]   = useState("");

  // Server URL
  const { serverUrl, serverUrlDraft, setServerUrlDraft, saveServerUrl } = useServerUrl();

  // Biometric
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled]   = useState(false);
  const [biometricEnabled, setBiometricEnabled]     = useState(false);
  const [biometricPassword, setBiometricPassword]   = useState("");
  const biometricName = "Biometrics";

  useEffect(() => {
    (async () => {
      const [supported, enrolled, enabled] = await Promise.all([
        isBiometricSupported(),
        hasBiometricEnrolled(),
        isBiometricEnabled(),
      ]);
      setBiometricSupported(supported);
      setBiometricEnrolled(enrolled);
      setBiometricEnabled(enabled);
    })();
  }, []);

  // Hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (view !== "account") { setView("account"); return true; }
      return false;
    });
    return () => handler.remove();
  }, [view]);


  // Sync drafts when user prop changes
  useEffect(() => {
    setNameDraft(user?.name || "");
    setEmailDraft(user?.email || "");
  }, [user?.name, user?.email]);

  function toggleSection(name) {
    setSection(s => s === name ? null : name);
  }

  async function handleSaveProfile() {
    const trimmedName  = nameDraft.trim();
    const trimmedEmail = emailDraft.trim().toLowerCase();
    if (!trimmedName)  return flash(false, "Name cannot be empty.");
    if (!trimmedEmail) return flash(false, "Email cannot be empty.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return flash(false, "Enter a valid email address.");

    const nameChanged  = trimmedName  !== user?.name;
    const emailChanged = trimmedEmail !== user?.email?.toLowerCase();

    if (!nameChanged && !emailChanged) { setSection(null); return; }
    if (emailChanged && !profilePw) return flash(false, "Enter your password to change email.");

    setLoadingProfile(true);
    try {
      const patch = {};
      if (nameChanged)  patch.name  = trimmedName;
      if (emailChanged) { patch.email = trimmedEmail; patch.currentPassword = profilePw; }
      await onUpdateProfile(patch);
      flash(true, "Profile updated.");
      setProfilePw("");
      setSection(null);
    } catch (e) {
      flash(false, e.message || "Failed to update profile.");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleSaveServerUrl() {
    if (!serverUrlDraft.startsWith("http")) return flash(false, "URL must start with http:// or https://");
    await saveServerUrl(serverUrlDraft);
    setSection(null);
    flash(true, "Server URL saved. Restart the app to apply.");
  }

  async function handleSaveNotifications() {
    const customDaysNum = parseInt(notifCustomDays, 10);
    if (notifFrequency === "custom" && (isNaN(customDaysNum) || customDaysNum < 1)) {
      return flash(false, "Custom days must be a number \u2265 1.");
    }

    if (notifEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return flash(false, "Could not get notification permission. A custom build is required on this device.");
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

  async function handleChangePassword() {
    if (newPw.length < 8)    return flash(false, "New password must be at least 8 characters.");
    if (newPw !== confirmPw) return flash(false, "Passwords do not match.");
    setLoadingPassword(true);
    try {
      await onChangePassword({ currentPassword: currentPw, newPassword: newPw });
      flash(true, "Password changed.");
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setSection(null);
    } catch (e) { flash(false, e.message); }
    finally { setLoadingPassword(false); }
  }

  async function handleDelete() {
    if (!deletePw) return flash(false, "Enter your password to confirm.");
    setLoadingDelete(true);
    try { await onDeleteAccount(deletePw); }
    catch (e) { flash(false, e.message); setLoadingDelete(false); }
  }

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

  // ── Sub-view renders ──

  if (view === "categories") {
    return (
      <View style={{ flex: 1 }}>
        <SubScreenHeader title="Categories" onBack={() => setView("account")} />
        <CategoriesScreen
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          investmentCategories={investmentCategories}
          customCats={customCats}
          onCreateCategory={onCreateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      </View>
    );
  }

  if (view === "household") {
    return (
      <View style={{ flex: 1 }}>
        <SubScreenHeader title="Household" onBack={() => setView("account")} />
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
      </View>
    );
  }

  // ── Main account view ──

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

        <Text style={[S.h2, { marginBottom: 20 }]}>Account</Text>

        {/* Household fetch error */}
        {householdError && (
          <View style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: C.redLight, borderWidth: 0.5, borderColor: C.redBorder }}>
            <Text style={{ fontSize: 13, color: C.redDark }}>Could not load household data: {String(householdError)}</Text>
          </View>
        )}

        {/* Pending invitations — always visible at the top */}
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

        {/* User info card */}
        <View style={[S.card, { marginBottom: 20 }]}>
          <View style={[S.row, { marginBottom: section === "editProfile" ? 14 : 0 }]}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.greenLight, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: C.greenDark }}>{user?.name?.charAt(0)?.toUpperCase() || "?"}</Text>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={S.h3}>{user?.name}</Text>
              <Text style={S.small}>{user?.email}</Text>
                  {household && (
                <Text style={{ fontSize: 12, color: C.greenDark, marginTop: 3 }}>
                  🏠 {household.name} · {user?.householdRole === "OWNER" ? "Owner" : "Member"}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => toggleSection("editProfile")} style={{ padding: 6 }}>
              <Text style={{ color: C.textTertiary, fontSize: 18 }}>{section === "editProfile" ? "−" : "✏️"}</Text>
            </TouchableOpacity>
          </View>

          {section === "editProfile" && (
            <View>
              <Text style={[S.label, { marginBottom: 5 }]}>Name</Text>
              <TextInput
                style={S.input}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="words"
              />
              <Text style={[S.label, { marginBottom: 5, marginTop: 10 }]}>Email</Text>
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
                  <Text style={[S.label, { marginBottom: 5, marginTop: 10 }]}>Confirm with your password</Text>
                  <PasswordInput value={profilePw} onChangeText={setProfilePw} />
                </>
              )}
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 12 }]} onPress={handleSaveProfile} disabled={loadingProfile}>
                {loadingProfile ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Dark Mode */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <View style={[S.rowBetween, { marginBottom: 4 }]}>
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
          <Text style={[S.small, { marginLeft: 30 }]}>Switch between light and dark theme</Text>
        </View>

        {/* Navigation cards */}
        <Text style={[S.sectionTitle, { marginTop: 12, marginBottom: 12 }]}>More</Text>
        <NavCard emoji="🏷️" label="Categories" onPress={() => setView("categories")} />
        <NavCard emoji="🏠" label="Household"  onPress={() => setView("household")} />

        <Text style={[S.sectionTitle, { marginTop: 12, marginBottom: 12 }]}>Settings</Text>

        {/* Display Currency */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <TouchableOpacity style={S.rowBetween} onPress={() => { onCurrencyPickerOpen?.(); setShowCurrencyPicker(true); }}>
            <View style={S.row}>
              <Text style={{ fontSize: 18, marginRight: 12 }}>💱</Text>
              <Text style={S.body}>Display Currency</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.green }}>{user?.currency} →</Text>
          </TouchableOpacity>
          <Text style={[S.small, { marginLeft: 30, marginTop: 4 }]}>Stored in original currency, converted on display</Text>
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
              {/* Enable toggle */}
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
                  {/* Frequency selector */}
                  <Text style={[S.label, { marginBottom: 8 }]}>Frequency</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    {["daily", "weekly", "monthly", "custom"].map(freq => (
                      <TouchableOpacity
                        key={freq}
                        onPress={() => setNotifFrequency(freq)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: notifFrequency === freq ? C.green : C.border,
                          backgroundColor: notifFrequency === freq ? C.greenLight : C.bg,
                        }}
                      >
                        <Text style={{
                          fontSize: 13,
                          fontWeight: notifFrequency === freq ? "700" : "400",
                          color: notifFrequency === freq ? C.greenDark : C.text,
                          textTransform: "capitalize",
                        }}>
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom days input */}
                  {notifFrequency === "custom" && (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={[S.label, { marginBottom: 5 }]}>Every N days</Text>
                      <TextInput
                        style={S.input}
                        value={notifCustomDays}
                        onChangeText={setNotifCustomDays}
                        keyboardType="numeric"
                        placeholder="e.g. 3"
                        placeholderTextColor={C.textTertiary}
                      />
                    </View>
                  )}

                  {/* Time picker */}
                  <Text style={[S.label, { marginBottom: 5 }]}>Reminder time</Text>
                  <TouchableOpacity
                    style={[S.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }]}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, color: C.text }}>{notifTime}</Text>
                    <Text style={{ fontSize: 16, color: C.textTertiary }}>🕐</Text>
                  </TouchableOpacity>
                  <TimePicker
                    visible={showTimePicker}
                    value={notifTime}
                    onChange={(t) => { setNotifTime(t); setShowTimePicker(false); }}
                    onClose={() => setShowTimePicker(false)}
                  />
                </>
              )}

              <TouchableOpacity
                style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 14 }]}
                onPress={handleSaveNotifications}
                disabled={loadingNotifications}
              >
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

        {/* Biometric Login */}
        {biometricSupported && biometricEnrolled && (
          <View style={[S.card, { marginBottom: 12 }]}>
            <TouchableOpacity
              style={S.rowBetween}
              onPress={() => !biometricEnabled && toggleSection("biometric")}
            >
              <View style={S.row}>
                <Text style={{ fontSize: 18, marginRight: 12 }}>🔐</Text>
                <Text style={S.body}>{biometricName} Login</Text>
              </View>
              {biometricEnabled
                ? (
                  // Wrap Switch in a View that stops touch events from bubbling
                  // up to the TouchableOpacity, preventing double-trigger.
                  <View onStartShouldSetResponder={() => true}>
                    <Switch value={true} onValueChange={handleBiometricToggle} trackColor={{ false: C.bgTertiary, true: C.greenLight }} thumbColor={C.green} />
                  </View>
                )
                : <Text style={{ color: C.textTertiary, fontSize: 18 }}>{section === "biometric" ? "−" : "+"}</Text>
              }
            </TouchableOpacity>

            <Text style={[S.small, { marginLeft: 30, marginTop: 4, color: biometricEnabled ? C.greenDark : C.textSecondary }]}>
              {biometricEnabled
                ? `Enabled · Sign in securely with ${biometricName.toLowerCase()}`
                : `Sign in quickly with ${biometricName.toLowerCase()}`
              }
            </Text>

            {section === "biometric" && !biometricEnabled && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
                  Enter your password to enable {biometricName.toLowerCase()} login. Your credentials will be stored securely on this device.
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

        {/* Change password */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <TouchableOpacity style={S.rowBetween} onPress={() => toggleSection("password")}>
            <View style={S.row}>
              <Text style={{ fontSize: 18, marginRight: 12 }}>🔑</Text>
              <Text style={S.body}>Change password</Text>
            </View>
            <Text style={{ color: C.textTertiary, fontSize: 18 }}>{section === "password" ? "−" : "+"}</Text>
          </TouchableOpacity>
          {section === "password" && (
            <View style={{ marginTop: 14 }}>
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
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={handleChangePassword} disabled={loadingPassword}>
                {loadingPassword ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Update password</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[S.card, { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 12 }]}
          onPress={onLogout}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
          <Text style={[S.body, { fontWeight: "600" }]}>Sign out</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <View style={[S.card, { borderColor: C.redBorder }]}>
          <TouchableOpacity style={S.rowBetween} onPress={() => toggleSection("delete")}>
            <View style={S.row}>
              <Text style={{ fontSize: 18, marginRight: 12 }}>🗑️</Text>
              <Text style={[S.body, { color: C.red }]}>Delete account</Text>
            </View>
            <Text style={{ color: C.red, fontSize: 18 }}>{section === "delete" ? "−" : "+"}</Text>
          </TouchableOpacity>
          {section === "delete" && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 13, color: C.redDark, marginBottom: 12 }}>
                This permanently deletes your account and all your data.
              </Text>
              <Text style={[S.label, { marginBottom: 5 }]}>Confirm with your password</Text>
              <PasswordInput value={deletePw} onChangeText={setDeletePw} />
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.red }]} onPress={handleDelete} disabled={loadingDelete}>
                {loadingDelete ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Permanently delete my account</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </ScrollView>
    <FeedbackBanner feedback={feedback} />
    </View>
  );
}
