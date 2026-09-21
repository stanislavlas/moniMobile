import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_NOTIF_PREFS = "budget_notification_prefs";
const NOTIF_IDENTIFIER = "budget_expense_reminder";

/**
 * Lazily load expo-notifications. Returns null when running in Expo Go (SDK 53+)
 * where the module is no longer bundled.
 */
function getNotifications() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("expo-notifications");
    // Verify the module is actually functional (not a stub)
    if (typeof mod.setNotificationHandler !== "function") return null;
    return mod;
  } catch {
    return null;
  }
}

// Set up the notification handler once at startup if the module is available.
const Notifications = getNotifications();
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Silently ignore — not available in this environment.
  }
}

/**
 * Request Android notification permission.
 * Returns true if granted, false otherwise.
 * Returns false silently when running in Expo Go.
 */
export async function requestNotificationPermission() {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Cancel all scheduled expense-reminder notifications.
 */
export async function cancelNotifications() {
  if (Notifications) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Not available in Expo Go.
    }
  }
  await AsyncStorage.removeItem(KEY_NOTIF_PREFS);
}

/**
 * Compute the trigger config for expo-notifications from user prefs.
 *
 * @param {string} time      - "HH:mm"
 * @param {string} frequency - "daily" | "weekly" | "monthly" | "custom"
 * @param {number} customDays
 * @returns {object} trigger object for scheduleNotificationAsync
 */
function buildTrigger(time, frequency, customDays) {
  const [hour, minute] = time.split(":").map(Number);

  if (frequency === "daily") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };
  }

  if (frequency === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 7 * 24 * 60 * 60,
      repeats: true,
    };
  }

  if (frequency === "monthly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30 * 24 * 60 * 60,
      repeats: true,
    };
  }

  if (frequency === "custom") {
    const days = Math.max(1, customDays || 1);
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: days * 24 * 60 * 60,
      repeats: true,
    };
  }

  // Fallback — daily
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
}

/**
 * Schedule the expense-reminder notification based on user preferences.
 * Cancels any existing one first to avoid duplicates.
 * No-ops silently when running in Expo Go.
 *
 * @param {object} prefs
 * @param {boolean} prefs.notificationsEnabled
 * @param {string}  prefs.notificationFrequency  - "daily" | "weekly" | "monthly" | "custom"
 * @param {number}  prefs.notificationCustomDays
 * @param {string}  prefs.notificationTime       - "HH:mm"
 */
export async function applyNotificationPreferences(prefs) {
  const {
    notificationsEnabled,
    notificationFrequency = "daily",
    notificationCustomDays = 1,
    notificationTime = "20:00",
  } = prefs || {};

  // expo-notifications not available in Expo Go — bail out silently.
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return;
  }

  if (!notificationsEnabled) {
    await AsyncStorage.removeItem(KEY_NOTIF_PREFS);
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const trigger = buildTrigger(notificationTime, notificationFrequency, notificationCustomDays);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDENTIFIER,
      content: {
        title: "Budget reminder",
        body: "Don't forget to log your expenses!",
      },
      trigger,
    });
  } catch {
    return;
  }

  // Persist so App.jsx can avoid redundant reschedules on every render
  await AsyncStorage.setItem(KEY_NOTIF_PREFS, JSON.stringify(prefs));
}
