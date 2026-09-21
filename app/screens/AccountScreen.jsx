import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch, Alert, BackHandler } from "react-native";
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
import { getServerUrl, setServerUrl, DEFAULT_URL } from "../../src/services/serverUrl.js";
import { requestNotificationPermission } from "../../src/services/notifications.js";
import { HistoryScreen } from "./HistoryScreen.jsx";
import { CategoriesScreen } from "./CategoriesScreen.jsx";
import { HouseholdScreen } from "./HouseholdScreen.jsx";
import { CurrencyPicker } from "../../src/components/CurrencyPicker.jsx";
import { PasswordInput } from "../../src/components/PasswordInput.jsx";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";
import { SubScreenHeader } from "../../src/components/SubScreenHeader.jsx";
import { NavCard } from "../../src/components/NavCard.jsx";

export function AccountScreen({
  user,
  household,
  onLogout,
  onDeleteAccount,
  onChangePassword,
  entries,
  onDelete,
  onUpdate,
  pendingSync,
  getCategoryById,
  colorMap,
  incomeCategories,
  expenseCategories,
  investmentCategories = [],
  allCategories,
  customCats,
  onCreateCategory,
  onDeleteCategory,
  onCreate,
  onAddMember,
  onRemoveMember,
  onLeave,
  onDeleteHousehold,
  onRename,
  openAddMember,
  setOpenAddMember,
  onUpdateProfile,
  currencyList = [],
}) {
  const { isDark, toggleTheme, colors: C, styles: S } = useTheme();
  const [view, setView]         = useState("account"); // "account" | "history" | "categories" | "household"
  const [section, setSection]   = useState(null);
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [deletePw, setDeletePw]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [feedback, setFeedback]     = useState(null);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

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
  const [serverUrl, setServerUrlState]     = useState("");
  const [serverUrlDraft, setServerUrlDraft] = useState("");
  useEffect(() => {
    getServerUrl().then(url => { setServerUrlState(url); setServerUrlDraft(url); });
  }, []);

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

  // Handle openAddMember flag from parent
  useEffect(() => {
    if (openAddMember && household) {
      setView("household");
      setOpenAddMember?.(false);
    }
  }, [openAddMember, household, setOpenAddMember]);

  // Sync drafts when user prop changes
  useEffect(() => {
    setNameDraft(user?.name || "");
    setEmailDraft(user?.email || "");
  }, [user?.name, user?.email]);

  function flash(ok, msg) { setFeedback({ ok, msg }); if (ok) setTimeout(() => setFeedback(null), 2500); }

  function toggleSection(name) {
    setSection(s => s === name ? null : name);
    setFeedback(null);
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

    setLoading(true);
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
      setLoading(false);
    }
  }

  async function handleSaveServerUrl() {
    if (!serverUrlDraft.startsWith("http")) return flash(false, "URL must start with http:// or https://");
    await setServerUrl(serverUrlDraft);
    setServerUrlState(serverUrlDraft);
    setSection(null);
    flash(true, "Server URL saved. Restart the app to apply.");
  }

  async function handleSaveNotifications() {
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(notifTime)) return flash(false, "Time must be in HH:mm format (e.g. 20:00).");
    const customDaysNum = parseInt(notifCustomDays, 10);
    if (notifFrequency === "custom" && (isNaN(customDaysNum) || customDaysNum < 1)) {
      return flash(false, "Custom days must be a number \u2265 1.");
    }

    if (notifEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return flash(false, "Could not get notification permission. A custom build is required on this device.");
    }

    setLoading(true);
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
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (newPw.length < 8)    return flash(false, "New password must be at least 8 characters.");
    if (newPw !== confirmPw) return flash(false, "Passwords do not match.");
    setLoading(true);
    try {
      await onChangePassword({ currentPassword: currentPw, newPassword: newPw });
      flash(true, "Password changed.");
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setSection(null);
    } catch (e) { flash(false, e.message); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!deletePw) return flash(false, "Enter your password to confirm.");
    setLoading(true);
    try { await onDeleteAccount(deletePw); }
    catch (e) { flash(false, e.message); setLoading(false); }
  }

  async function handleBiometricToggle(enable) {
    if (enable) {
      if (section !== "biometric") { setSection("biometric"); return; }
      if (!biometricPassword) return flash(false, "Enter your password to enable biometric login.");
      setLoading(true);
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
        setLoading(false);
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

  if (view === "history") {
    return (
      <View style={{ flex: 1 }}>
        <SubScreenHeader title="History" onBack={() => setView("account")} />
        <HistoryScreen
          entries={entries}
          onDelete={onDelete}
          onUpdate={onUpdate}
          household={household}
          getCategoryById={getCategoryById}
          colorMap={colorMap}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          allCategories={allCategories}
          pendingSync={pendingSync}
        />
      </View>
    );
  }

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
          onAddMember={onAddMember}
          onRemoveMember={onRemoveMember}
          onLeave={onLeave}
          onDelete={onDeleteHousehold}
          onRename={onRename}
          autoOpenAddMember={openAddMember}
        />
      </View>
    );
  }

  // ── Main account view ──

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

        <Text style={[S.h2, { marginBottom: 20 }]}>Account</Text>

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
                  🏠 {household.name} · {household.ownerId === user?.userId ? "Owner" : "Member"}
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
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 12 }]} onPress={handleSaveProfile} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <FeedbackBanner feedback={feedback} />

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
        <NavCard emoji="📋" label="History"    onPress={() => setView("history")} />
        <NavCard emoji="🏷️" label="Categories" onPress={() => setView("categories")} />
        <NavCard emoji="🏠" label="Household"  onPress={() => setView("household")} />

        <Text style={[S.sectionTitle, { marginTop: 12, marginBottom: 12 }]}>Settings</Text>

        {/* Display Currency */}
        <View style={[S.card, { marginBottom: 12 }]}>
          <TouchableOpacity style={S.rowBetween} onPress={() => setShowCurrencyPicker(true)}>
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

                  {/* Time input */}
                  <Text style={[S.label, { marginBottom: 5 }]}>Reminder time (HH:mm)</Text>
                  <TextInput
                    style={S.input}
                    value={notifTime}
                    onChangeText={setNotifTime}
                    placeholder="20:00"
                    placeholderTextColor={C.textTertiary}
                    keyboardType="numeric"
                  />
                </>
              )}

              <TouchableOpacity
                style={[S.btnPrimary, { backgroundColor: C.green, marginTop: 14 }]}
                onPress={handleSaveNotifications}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Save</Text>}
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
          <Text style={[S.small, { marginLeft: 30, marginTop: 4 }]} numberOfLines={1}>{serverUrl}</Text>
          {section === "serverUrl" && (
            <View style={{ marginTop: 14 }}>
              <Text style={[S.label, { marginBottom: 5 }]}>Backend URL</Text>
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
        </View>

        {/* Biometric Login */}
        {biometricSupported && biometricEnrolled && (
          <View style={[S.card, { marginBottom: 12 }]}>
            <TouchableOpacity
              style={S.rowBetween}
              onPress={() => biometricEnabled ? handleBiometricToggle(false) : toggleSection("biometric")}
            >
              <View style={S.row}>
                <Text style={{ fontSize: 18, marginRight: 12 }}>🔐</Text>
                <Text style={S.body}>{biometricName} Login</Text>
              </View>
              {biometricEnabled
                ? <Switch value={true} onValueChange={handleBiometricToggle} trackColor={{ false: C.bgTertiary, true: C.greenLight }} thumbColor={C.green} />
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
                <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={() => handleBiometricToggle(true)} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Enable {biometricName}</Text>}
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
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={handleChangePassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Update password</Text>}
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
              <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.red }]} onPress={handleDelete} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnPrimaryText}>Permanently delete my account</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </ScrollView>
  );
}
