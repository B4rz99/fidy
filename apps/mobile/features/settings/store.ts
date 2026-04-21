import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { Appearance } from "@/shared/components/rn";
import { captureWarning } from "@/shared/lib";

export type ThemePreference = "system" | "light" | "dark";

export type NotificationPreferences = {
  readonly budgetAlerts: boolean;
  readonly goalMilestones: boolean;
  readonly spendingAnomalies: boolean;
  readonly weeklyDigest: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  budgetAlerts: true,
  goalMilestones: true,
  spendingAnomalies: true,
  weeklyDigest: true,
};

type SettingsState = {
  themePreference: ThemePreference;
  notificationPreferences: NotificationPreferences;
  areAllNotificationsOff: boolean;
};

type SettingsActions = {
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setAllNotifications: (enabled: boolean) => void;
  hydrate: () => Promise<void>;
};

const PREFS_KEY = "notification_preferences";
const THEME_PREFERENCE_KEY = "theme_preference";

const toColorScheme = (pref: ThemePreference) => (pref === "system" ? "unspecified" : pref);

const computeAllOff = (prefs: NotificationPreferences): boolean =>
  !prefs.budgetAlerts && !prefs.goalMilestones && !prefs.spendingAnomalies && !prefs.weeklyDigest;

const persistPreferences = (prefs: NotificationPreferences): void => {
  void SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)).catch((error) => {
    captureWarning("notification_prefs_persist_failed", {
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  });
};

const resolveThemePreference = (value: string | null): ThemePreference | null =>
  value === "light" || value === "dark" || value === "system" ? value : null;

const parseStoredNotificationPreferences = (
  value: string | null
): NotificationPreferences | null => {
  if (!value) {
    return null;
  }

  const raw: unknown = JSON.parse(value);
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(typeof raw === "object" && raw !== null ? (raw as Partial<NotificationPreferences>) : {}),
  };
};

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  themePreference: "system",
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  areAllNotificationsOff: false,

  setThemePreference: (pref) => {
    set({ themePreference: pref });
    Appearance.setColorScheme(toColorScheme(pref));
    void SecureStore.setItemAsync(THEME_PREFERENCE_KEY, pref).catch((error) => {
      captureWarning("theme_preference_persist_failed", {
        errorMessage: error instanceof Error ? error.message : "unknown",
      });
    });
  },

  setNotificationPreference: (key, value) => {
    const updated = { ...get().notificationPreferences, [key]: value };
    set({
      notificationPreferences: updated,
      areAllNotificationsOff: computeAllOff(updated),
    });
    persistPreferences(updated);
  },

  setAllNotifications: (enabled) => {
    const updated: NotificationPreferences = {
      budgetAlerts: enabled,
      goalMilestones: enabled,
      spendingAnomalies: enabled,
      weeklyDigest: enabled,
    };
    set({
      notificationPreferences: updated,
      areAllNotificationsOff: computeAllOff(updated),
    });
    persistPreferences(updated);
  },

  hydrate: async () => {
    try {
      const [storedTheme, storedPrefs] = await Promise.all([
        SecureStore.getItemAsync(THEME_PREFERENCE_KEY),
        SecureStore.getItemAsync(PREFS_KEY),
      ]);
      const themePreference = resolveThemePreference(storedTheme);

      if (themePreference) {
        set({ themePreference });
        Appearance.setColorScheme(toColorScheme(themePreference));
      }

      const notificationPreferences = parseStoredNotificationPreferences(storedPrefs);

      if (!notificationPreferences) {
        return;
      }

      set({
        notificationPreferences,
        areAllNotificationsOff: computeAllOff(notificationPreferences),
      });
    } catch {
      // SecureStore unavailable (e.g., in tests)
    }
  },
}));
