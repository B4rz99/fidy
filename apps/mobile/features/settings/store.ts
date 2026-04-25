import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { RemoteBackupMetadata } from "@/features/backup/public";
import { Appearance } from "@/shared/components/rn";
import { captureWarning } from "@/shared/lib";
import {
  DEFAULT_PRIVATE_BACKUP_STATE,
  loadPrivateBackupSettingsState,
  markPrivateBackupConfirmed,
  markPrivateBackupFailed,
  type PrivateBackupSettingsState,
  persistPrivateBackupState,
  preparePrivateBackupSetup,
} from "./lib/private-backup-settings-state";

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
  privateBackup: PrivateBackupSettingsState;
};

type SetSettingsState = (partial: Partial<SettingsState>) => void;

type SettingsActions = {
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setAllNotifications: (enabled: boolean) => void;
  beginPrivateBackupSetup: (recoveryKey: string) => void;
  confirmPrivateBackupRecoveryKey: (
    confirmedRecoveryKey: string,
    latestBackup: RemoteBackupMetadata
  ) => void;
  markPrivateBackupUploadFailed: (failedAt: string) => void;
  markPrivateBackupUploadReady: (latestBackup: RemoteBackupMetadata) => void;
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

const loadStoredSettings = async () => {
  const [storedTheme, storedPrefs, privateBackup] = await Promise.all([
    SecureStore.getItemAsync(THEME_PREFERENCE_KEY),
    SecureStore.getItemAsync(PREFS_KEY),
    loadPrivateBackupSettingsState(),
  ]);

  return {
    storedTheme,
    storedPrefs,
    privateBackup,
  };
};

const applyStoredThemePreference = (set: SetSettingsState, storedTheme: string | null) => {
  const themePreference = resolveThemePreference(storedTheme);
  if (!themePreference) {
    return;
  }

  set({ themePreference });
  Appearance.setColorScheme(toColorScheme(themePreference));
};

const applyStoredPrivateBackup = (
  set: SetSettingsState,
  privateBackup: PrivateBackupSettingsState | null
) => {
  if (privateBackup) {
    set({ privateBackup });
  }
};

const applyStoredNotificationPreferences = (set: SetSettingsState, storedPrefs: string | null) => {
  const notificationPreferences = parseStoredNotificationPreferences(storedPrefs);
  if (!notificationPreferences) {
    return;
  }

  set({
    notificationPreferences,
    areAllNotificationsOff: computeAllOff(notificationPreferences),
  });
};

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  themePreference: "system",
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  areAllNotificationsOff: false,
  privateBackup: DEFAULT_PRIVATE_BACKUP_STATE,

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

  beginPrivateBackupSetup: (recoveryKey) => {
    const privateBackup = preparePrivateBackupSetup(get().privateBackup, recoveryKey);
    set({
      privateBackup,
    });
    persistPrivateBackupState(privateBackup);
  },

  confirmPrivateBackupRecoveryKey: (confirmedRecoveryKey, latestBackup) => {
    const currentRecoveryKey = get().privateBackup.generatedRecoveryKey;
    if (currentRecoveryKey === null || confirmedRecoveryKey !== currentRecoveryKey) {
      return;
    }

    const privateBackup = markPrivateBackupConfirmed(get().privateBackup, latestBackup);
    set({ privateBackup });
    persistPrivateBackupState(privateBackup);
  },

  markPrivateBackupUploadFailed: (failedAt) => {
    const privateBackup = markPrivateBackupFailed(get().privateBackup, failedAt);
    set({ privateBackup });
    persistPrivateBackupState(privateBackup);
  },

  markPrivateBackupUploadReady: (latestBackup) => {
    const privateBackup = markPrivateBackupConfirmed(get().privateBackup, latestBackup);
    set({ privateBackup });
    persistPrivateBackupState(privateBackup);
  },

  hydrate: async () => {
    try {
      const stored = await loadStoredSettings();
      applyStoredThemePreference(set, stored.storedTheme);
      applyStoredPrivateBackup(set, stored.privateBackup);
      applyStoredNotificationPreferences(set, stored.storedPrefs);
    } catch {
      // SecureStore unavailable (e.g., in tests)
    }
  },
}));
