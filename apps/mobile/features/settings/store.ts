import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { create } from "zustand";

export type ThemePreference = "system" | "light" | "dark";

type SettingsState = {
  themePreference: ThemePreference;
  notificationsEnabled: boolean;
  isDeleting: boolean;
};

type SettingsActions = {
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  deleteAccount: (supabaseUrl: string, token: string) => Promise<void>;
  hydrate: () => Promise<void>;
};

const toColorScheme = (pref: ThemePreference) => (pref === "system" ? "unspecified" : pref);

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  themePreference: "system",
  notificationsEnabled: true,
  isDeleting: false,

  setThemePreference: (pref) => {
    set({ themePreference: pref });
    Appearance.setColorScheme(toColorScheme(pref));
    SecureStore.setItemAsync("theme_preference", pref).catch(() => {});
  },

  // Placeholder: only toggles local UI state until push notifications are wired up
  setNotificationsEnabled: (enabled) => {
    set({ notificationsEnabled: enabled });
  },

  deleteAccount: async (supabaseUrl, token) => {
    set({ isDeleting: true });
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
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
      const stored = await SecureStore.getItemAsync("theme_preference");
      if (stored === "light" || stored === "dark" || stored === "system") {
        set({ themePreference: stored });
        Appearance.setColorScheme(toColorScheme(stored));
      }
    } catch {
      // SecureStore unavailable (e.g., in tests)
    }
  },
}));
