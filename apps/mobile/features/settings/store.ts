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
};

export type ParseImprovementSharingPreferenceState =
  | "unhydrated"
  | "unavailable"
  | "default_enabled"
  | "explicit_enabled"
  | "explicit_disabled";

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  budgetAlerts: true,
  goalMilestones: true,
  spendingAnomalies: true,
};

type SettingsState = {
  themePreference: ThemePreference;
  isHydrated: boolean;
  notificationPreferences: NotificationPreferences;
  areAllNotificationsOff: boolean;
  privateBackup: PrivateBackupSettingsState;
  shareAnonymizedParseSamples: boolean;
  parseImprovementSharingPreferenceState: ParseImprovementSharingPreferenceState;
};

type SetSettingsState = (partial: Partial<SettingsState>) => void;

type SettingsActions = {
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setNotificationPreferenceForSession: (key: keyof NotificationPreferences, value: boolean) => void;
  setAllNotifications: (enabled: boolean) => void;
  setShareAnonymizedParseSamples: (enabled: boolean) => void;
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
const SHARE_ANONYMIZED_PARSE_SAMPLES_KEY = "share_anonymized_parse_samples";

const toColorScheme = (pref: ThemePreference) => (pref === "system" ? "unspecified" : pref);

const computeAllOff = (prefs: NotificationPreferences): boolean =>
  !prefs.budgetAlerts && !prefs.goalMilestones && !prefs.spendingAnomalies;

const persistPreferences = (prefs: NotificationPreferences): void => {
  void SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)).catch((error) => {
    captureWarning("notification_prefs_persist_failed", {
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  });
};

const resolveThemePreference = (value: string | null): ThemePreference | null =>
  value === "light" || value === "dark" || value === "system" ? value : null;

const isStoredNotificationPreferences = (value: unknown): value is NotificationPreferences => {
  const record =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

  return (
    record !== null &&
    typeof record.budgetAlerts === "boolean" &&
    typeof record.goalMilestones === "boolean" &&
    typeof record.spendingAnomalies === "boolean"
  );
};

const parseStoredNotificationPreferences = (
  value: string | null
): NotificationPreferences | null => {
  if (!value) {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(value);
    return isStoredNotificationPreferences(raw) ? raw : null;
  } catch {
    return null;
  }
};

const loadStoredSettings = async () => {
  const [storedTheme, storedPrefs, storedShareAnonymizedParseSamples, privateBackup] =
    await Promise.all([
      SecureStore.getItemAsync(THEME_PREFERENCE_KEY),
      SecureStore.getItemAsync(PREFS_KEY),
      SecureStore.getItemAsync(SHARE_ANONYMIZED_PARSE_SAMPLES_KEY),
      loadPrivateBackupSettingsState(),
    ]);

  return {
    storedTheme,
    storedPrefs,
    storedShareAnonymizedParseSamples,
    privateBackup,
  };
};

const applyStoredThemePreference = (set: SetSettingsState, storedTheme: string | null) => {
  const themePreference = resolveThemePreference(storedTheme) ?? "system";

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

const resolveStoredShareAnonymizedParseSamples = (
  value: string | null,
  currentPreferenceState: ParseImprovementSharingPreferenceState
): {
  readonly enabled: boolean;
  readonly preferenceState: ParseImprovementSharingPreferenceState;
} => {
  if (currentPreferenceState === "explicit_disabled") {
    return { enabled: false, preferenceState: "explicit_disabled" };
  }
  if (value === "false") {
    return { enabled: false, preferenceState: "explicit_disabled" };
  }
  if (value === "true") {
    return { enabled: true, preferenceState: "explicit_enabled" };
  }
  return { enabled: true, preferenceState: "default_enabled" };
};

export const isAuthoritativeParseImprovementOptOut = (state: {
  readonly parseImprovementSharingPreferenceState: ParseImprovementSharingPreferenceState;
}): boolean => state.parseImprovementSharingPreferenceState === "explicit_disabled";

export const isExplicitParseImprovementOptIn = (state: {
  readonly parseImprovementSharingPreferenceState: ParseImprovementSharingPreferenceState;
}): boolean => state.parseImprovementSharingPreferenceState === "explicit_enabled";

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  themePreference: "system",
  isHydrated: false,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  areAllNotificationsOff: false,
  privateBackup: DEFAULT_PRIVATE_BACKUP_STATE,
  shareAnonymizedParseSamples: false,
  parseImprovementSharingPreferenceState: "unhydrated",

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

  setNotificationPreferenceForSession: (key, value) => {
    const updated = { ...get().notificationPreferences, [key]: value };
    set({
      notificationPreferences: updated,
      areAllNotificationsOff: computeAllOff(updated),
    });
  },

  setAllNotifications: (enabled) => {
    const updated: NotificationPreferences = {
      budgetAlerts: enabled,
      goalMilestones: enabled,
      spendingAnomalies: enabled,
    };
    set({
      notificationPreferences: updated,
      areAllNotificationsOff: computeAllOff(updated),
    });
    persistPreferences(updated);
  },

  setShareAnonymizedParseSamples: (enabled) => {
    set({
      shareAnonymizedParseSamples: enabled,
      parseImprovementSharingPreferenceState: enabled ? "explicit_enabled" : "explicit_disabled",
    });
    void SecureStore.setItemAsync(SHARE_ANONYMIZED_PARSE_SAMPLES_KEY, String(enabled)).catch(
      (error) => {
        captureWarning("parse_sample_sharing_preference_persist_failed", {
          errorMessage: error instanceof Error ? error.message : "unknown",
        });
      }
    );
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
      const storedShareAnonymizedParseSamples = resolveStoredShareAnonymizedParseSamples(
        stored.storedShareAnonymizedParseSamples,
        get().parseImprovementSharingPreferenceState
      );
      set({
        shareAnonymizedParseSamples: storedShareAnonymizedParseSamples.enabled,
        parseImprovementSharingPreferenceState: storedShareAnonymizedParseSamples.preferenceState,
      });
    } catch {
      // SecureStore unavailable (e.g., in tests)
      const currentPreferenceState = get().parseImprovementSharingPreferenceState;
      Appearance.setColorScheme(toColorScheme("system"));
      set({
        themePreference: "system",
        parseImprovementSharingPreferenceState:
          currentPreferenceState === "explicit_disabled" ? "explicit_disabled" : "unavailable",
        shareAnonymizedParseSamples: false,
      });
    } finally {
      set({ isHydrated: true });
    }
  },
}));
