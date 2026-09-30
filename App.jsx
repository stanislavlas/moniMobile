import "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StatusBar, ActivityIndicator, Modal } from "react-native";
import { useAuth }         from "./src/hooks/useAuth.js";
import { useEntries }      from "./src/hooks/useEntries.js";
import { useHousehold }    from "./src/hooks/useHousehold.js";
import { useCategories }   from "./src/hooks/useCategories.js";
import { useCurrencies }   from "./src/hooks/useCurrencies.js";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext.js";
import { NetworkProvider } from "./src/contexts/NetworkContext.js";
import { SyncIndicator }   from "./src/components/SyncIndicator.jsx";
import { OfflineBanner }   from "./src/components/OfflineBanner.jsx";
import { FeedbackBanner }  from "./src/components/FeedbackBanner.jsx";
import { AuthScreen }        from "./app/screens/AuthScreen.jsx";
import { MonthOverviewScreen } from "./app/screens/MonthOverviewScreen.jsx";
import { YearOverviewScreen }  from "./app/screens/YearOverviewScreen.jsx";
import { AddScreen }         from "./app/screens/AddScreen.jsx";
import { AccountScreen }     from "./app/screens/AccountScreen.jsx";
import { HistoryScreen }     from "./app/screens/HistoryScreen.jsx";
import { authenticateWithBiometric } from "./src/services/biometric.js";
import { applyNotificationPreferences } from "./src/services/notifications.js";
import { logger } from "./src/utils/logger.js";
import { currentYearMonth } from "./src/utils/entries.js";

const TABS = [
  { id: "month",   label: "Month",   icon: "month" },
  { id: "year",    label: "Year",    icon: "year" },
  { id: "add",     label: "Add",     icon: "add" },
  { id: "history", label: "History", icon: "history" },
  { id: "account", label: "Account", icon: "account" },
];

function AppContent() {
  const { isDark, colors: C, styles: S } = useTheme();
  const [appError, setAppError] = useState(null);
  const [biometricFeedback, setBiometricFeedback] = useState(null);
  const biometricFeedbackTimerRef = useRef(null);

  // Clean up biometric feedback timer on unmount
  useEffect(() => {
    return () => { if (biometricFeedbackTimerRef.current) clearTimeout(biometricFeedbackTimerRef.current); };
  }, []);

  // Global error handler — use logger, restore previous handler on unmount
  useEffect(() => {
    if (!global.ErrorUtils) return;
    const prev = global.ErrorUtils.getGlobalHandler?.();
    const errorHandler = (error, isFatal) => {
      logger.error('ui', 'Global error', error?.message);
      setAppError(error?.message || String(error));
    };
    global.ErrorUtils.setGlobalHandler(errorHandler);
    return () => { if (prev) global.ErrorUtils.setGlobalHandler(prev); };
  }, []);

  const auth = useAuth();
  const { user, isAuthenticated, ready, loading: authLoading, error: authError, clearError, login, register, logout, deleteAccount, changePassword, updateProfile, loginWithBiometric, pendingBiometricEnroll, confirmBiometricEnroll, dismissBiometricEnroll, pendingRegistration, verifyRegistration, resendRegistrationCode, cancelRegistrationVerification } = auth;

  const [tab, setTab]               = useState("month");
  const [filterMonth, setFilterMonth] = useState(currentYearMonth);
  const [showPersonalOnly, setShowPersonalOnly] = useState(false); // Toggle for personal vs household view

  const {
    household, pendingInvitations, pendingCount,
    error: householdError,
    createHousehold, sendInvitation, acceptInvitation, rejectInvitation, cancelInvitation,
    removeMember, leaveHousehold, deleteHousehold, renameHousehold,
  } = useHousehold(isAuthenticated);
  // Prefer householdId from the user object (available immediately on rehydration) with
  // the full household object as fallback once it loads from the server.
  const householdId = user?.householdId || household?.householdId || null;

  // Reset to default tab on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setTab("month");
    }
  }, [isAuthenticated]);

  const { currencyList, loading: currenciesLoading, load: loadCurrencies } = useCurrencies();

  // Show household entries when user is in a household and hasn't toggled to personal
  const showHousehold = !!householdId && !showPersonalOnly;

  const { addEntry, updateEntry, removeEntry, pendingSync, refreshAll } = useEntries();

  const { incomeCategories, expenseCategories, investmentCategories, allCategories, customCats, colorMap, getCategoryById, createCategory, deleteCategory } = useCategories(isAuthenticated, householdId);

  // Wrap updateProfile: when currency or name changes, re-fetch entries
  // (currency affects converted amounts; name affects authorName shown in By Member)
  const handleUpdateProfile = useCallback(async (patch) => {
    const updated = await updateProfile(patch);
    if (patch.currency || patch.name) {
      await refreshAll();
    }
    return updated;
  }, [updateProfile, refreshAll]);

  // Schedule / cancel notifications whenever the authenticated user's prefs change
  useEffect(() => {
    if (user) {
      applyNotificationPreferences(user).catch(() => {});
    }
  }, [
    user?.notificationsEnabled,
    user?.notificationFrequency,
    user?.notificationCustomDays,
    user?.notificationTime,
  ]);

  // Show error screen if something crashed
  if (appError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg, padding: 20 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: "center", marginBottom: 20 }}>{appError}</Text>
        <TouchableOpacity onPress={() => setAppError(null)} style={{ backgroundColor: C.green, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Splash screen while AsyncStorage rehydrates
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>💰</Text>
        <ActivityIndicator color={C.green} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={login} onRegister={register} loading={authLoading} error={authError} onClearError={clearError} onBiometricLogin={loginWithBiometric} currencyList={currencyList} currenciesLoading={currenciesLoading} onCurrencyPickerOpen={loadCurrencies} pendingRegistration={pendingRegistration} onVerifyRegistration={verifyRegistration} onResendRegistrationCode={resendRegistrationCode} onCancelRegistration={cancelRegistrationVerification} />;
  }

  // Category data passed down to all screens
  const catProps = { incomeCategories, expenseCategories, investmentCategories, allCategories, colorMap, getCategoryById };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: StatusBar.currentHeight || 0 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={C.bg} translucent={false} />
      <FeedbackBanner feedback={biometricFeedback} />

      {/* Biometric enrollment prompt — shown after login/register when device supports biometrics.
          Note: this uses authenticateWithBiometric directly (enrollment confirmation flow).
          The loginWithBiometric hook is a separate flow used for subsequent sign-ins. */}
      <Modal visible={!!pendingBiometricEnroll} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.cardBg, borderRadius: 16, padding: 24, width: "100%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 8 }}>Enable Biometrics?</Text>
            <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
              Sign in quickly next time using biometrics instead of your password.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: C.green, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 10 }}
              onPress={async () => {
                try {
                  const ok = await authenticateWithBiometric();
                  if (ok) {
                    await confirmBiometricEnroll();
                    if (biometricFeedbackTimerRef.current) clearTimeout(biometricFeedbackTimerRef.current);
                    setBiometricFeedback({ ok: true, msg: "Biometrics enabled" });
                    biometricFeedbackTimerRef.current = setTimeout(() => { biometricFeedbackTimerRef.current = null; setBiometricFeedback(null); }, 2500);
                  } else {
                    dismissBiometricEnroll();
                  }
                } catch {
                  dismissBiometricEnroll();
                }
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Enable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius: 10, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: C.border }}
              onPress={dismissBiometricEnroll}
            >
              <Text style={{ color: C.textSecondary, fontWeight: "600", fontSize: 15 }}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: C.border,
      }}>
        {/* Left side - Logo and app name */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image
            source={require("./assets/no_background.png")}
            style={{ width: 28, height: 28, resizeMode: "contain" }}
          />
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Moni</Text>
        </View>

        {/* Right side - View toggle, sync indicator and loading indicator */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {household && (
            <TouchableOpacity
              onPress={() => setShowPersonalOnly(!showPersonalOnly)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 0.5,
                borderColor: showPersonalOnly ? C.border : C.greenBorder,
                backgroundColor: showPersonalOnly ? "transparent" : C.greenLight,
              }}
            >
              <Text style={{ fontSize: 16 }}>🏠</Text>
            </TouchableOpacity>
          )}
          <SyncIndicator />
        </View>
      </View>

      {/* Offline banner — shown when offline with pending changes */}
      <OfflineBanner />

      {/* Screens */}
      <View style={{ flex: 1 }}>
        {tab === "month" && (
          <MonthOverviewScreen
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            household={household}
            showPersonalOnly={showPersonalOnly}
            pendingSync={pendingSync}
            userCurrency={user?.currency}
            {...catProps}
          />
        )}
        {tab === "history" && (
          <HistoryScreen
            user={user}
            onDelete={removeEntry}
            onUpdate={updateEntry}
            household={household}
            showPersonalOnly={showPersonalOnly}
            pendingSync={pendingSync}
            {...catProps}
          />
        )}
        {tab === "year" && (
          <YearOverviewScreen
            filterMonth={filterMonth}
            userCurrency={user?.currency}
            household={household}
            showPersonalOnly={showPersonalOnly}
            getCategoryById={getCategoryById}
            colorMap={colorMap}
          />
        )}
        {tab === "add" && (
          <AddScreen onAdd={addEntry} authorName={user?.name} currency={user?.currency} currencyList={currencyList} currenciesLoading={currenciesLoading} onCurrencyPickerOpen={loadCurrencies} incomeCategories={incomeCategories} expenseCategories={expenseCategories} investmentCategories={investmentCategories} colorMap={colorMap} />
        )}
        {tab === "account" && (
          <AccountScreen
            user={user}
            household={household}
            householdError={householdError}
            pendingInvitations={pendingInvitations}
            onLogout={logout}
            onDeleteAccount={deleteAccount}
            onChangePassword={changePassword}
            {...catProps}
            customCats={customCats}
            onCreateCategory={createCategory}
            onDeleteCategory={deleteCategory}
            onCreate={createHousehold}
            onInvite={sendInvitation}
            onAcceptInvitation={acceptInvitation}
            onRejectInvitation={rejectInvitation}
            onCancelInvitation={cancelInvitation}
            onRemoveMember={removeMember}
            onLeave={leaveHousehold}
            onDeleteHousehold={deleteHousehold}
            onRename={renameHousehold}

            onUpdateProfile={handleUpdateProfile}
            currencyList={currencyList}
            currenciesLoading={currenciesLoading}
            onCurrencyPickerOpen={loadCurrencies}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.cardBg,
        borderTopWidth: 0.5,
        borderTopColor: C.border,
        paddingBottom: 12,
        paddingTop: 8,
        paddingHorizontal: 4,
      }}>
        {TABS.map(t => {
          const active = tab === t.id;

          // Center Add button — elevated rounded square
          if (t.id === "add") {
            return (
              <View key={t.id} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <TouchableOpacity
                  onPress={() => { setTab(t.id); }}
                  activeOpacity={0.8}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: isDark ? "#2D2B52" : "#E8E6F5",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 2,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <Text style={{ fontSize: 28, lineHeight: 32, color: isDark ? "#A89FD6" : "#6B63B5", fontWeight: "300" }}>+</Text>
                </TouchableOpacity>
              </View>
            );
          }

          // Regular tab — active gets pill background with icon+label, inactive just icon+label
          const iconMap = {
            month:   "📅",
            history: "🕐",
            year:    "📊",
            account: "👤",
          };
          const emoji = iconMap[t.id] ?? "•";
          const hasNotification = t.id === "account" && pendingCount > 0;

          return (
            <TouchableOpacity
              key={t.id}
              style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}
              onPress={() => { setTab(t.id); }}
              activeOpacity={0.7}
            >
              {/* Always 2 rows: icon on top, label below. Active gets pill background. */}
              <View style={{
                alignItems: "center",
                alignSelf: "center",
                backgroundColor: active ? (isDark ? "#2A2A3D" : "#ECEAF8") : "transparent",
                borderRadius: active ? 14 : 0,
                overflow: "hidden",
                paddingHorizontal: active ? 14 : 0,
                paddingVertical: active ? 5 : 0,
              }}>
                <View style={{ position: "relative" }}>
                  <Text style={{ fontSize: 16, color: active ? C.text : C.textTertiary }}>{emoji}</Text>
                  {hasNotification && !active && (
                    <View style={{
                      position: "absolute",
                      top: -1,
                      right: -3,
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: "#E53935",
                      borderWidth: 1,
                      borderColor: C.cardBg,
                    }} />
                  )}
                </View>
                <Text style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: active ? C.text : C.textTertiary,
                  fontWeight: active ? "700" : "400",
                }}>
                  {t.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NetworkProvider>
          <AppContent />
        </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
