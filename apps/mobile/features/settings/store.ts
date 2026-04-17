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
  isDeleting: boolean;
};

type SettingsActions = {
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setAllNotifications: (enabled: boolean) => void;
  deleteAccount: (supabaseUrl: string, token: string) => Promise<void>;
  hydrate: () => Promise<void>;
};

const PREFS_KEY = "notification_preferences";

const toColorScheme = (pref: ThemePreference) => (pref === "system" ? "unspecified" : pref);

const computeAllOff = (prefs: NotificationPreferences): boolean =>
  !prefs.budgetAlerts && !prefs.goalMilestones && !prefs.spendingAnomalies && !prefs.weeklyDigest;

const persistPreferences = (prefs: NotificationPreferences): void => {
  void SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
  // Best-effort Supabase dual write (lazy import to avoid circular deps)
  import("@/shared/db/supabase")
    .then(async ({ getSupabase }) => {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          // biome-ignore lint/style/useNamingConvention: Supabase column name
          user_id: data.user.id,
          // biome-ignore lint/style/useNamingConvention: Supabase column name
          budget_alerts: prefs.budgetAlerts,
          // biome-ignore lint/style/useNamingConvention: Supabase column name
          goal_milestones: prefs.goalMilestones,
          // biome-ignore lint/style/useNamingConvention: Supabase column name
          spending_anomalies: prefs.spendingAnomalies,
          // biome-ignore lint/style/useNamingConvention: Supabase column name
          weekly_digest: prefs.weeklyDigest,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        const { captureWarning } = await import("@/shared/lib");
        captureWarning("notification_prefs_sync_failed", { errorMessage: error.message });
      }
    })
    .catch((error) => {
      captureWarning("notification_prefs_load_failed", {
        errorMessage: error instanceof Error ? error.message : "unknown",
      });
    });
};

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  themePreference: "system",
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  areAllNotificationsOff: false,
  isDeleting: false,

  setThemePreference: (pref) => {
    set({ themePreference: pref });
    Appearance.setColorScheme(toColorScheme(pref));
    void SecureStore.setItemAsync("theme_preference", pref);
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

  deleteAccount: async (supabaseUrl, token) => {
    set({ isDeleting: true });
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          // biome-ignore lint/style/useNamingConvention: HTTP header
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- fetch response body is untyped
        const body: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "delete_failed");
      }

      const { useAuthStore } = await import("@/features/auth");
      await useAuthStore.getState().signOut();
    } finally {
      set({ isDeleting: false });
    }
  },

  hydrate: async () => {
    try {
      const [storedTheme, storedPrefs] = await Promise.all([
        SecureStore.getItemAsync("theme_preference"),
        SecureStore.getItemAsync(PREFS_KEY),
      ]);

      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
        set({ themePreference: storedTheme });
        Appearance.setColorScheme(toColorScheme(storedTheme));
      }

      if (storedPrefs) {
        const raw: unknown = JSON.parse(storedPrefs);
        const parsed: NotificationPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}),
        };
        set({
          notificationPreferences: parsed,
          areAllNotificationsOff: computeAllOff(parsed),
        });
      }
    } catch {
      // SecureStore unavailable (e.g., in tests)
    }
  },
}));
