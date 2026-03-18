import { beforeEach, describe, expect, test } from "vitest";
import { useSettingsStore } from "@/features/settings/store";

describe("useSettingsStore", () => {
  test("has correct initial defaults", () => {
    // Mutate to non-defaults first to prove getInitialState is independent
    useSettingsStore.setState({
      themePreference: "dark",
      notificationsEnabled: false,
      isDeleting: true,
    });
    const initial = useSettingsStore.getInitialState();
    expect(initial.themePreference).toBe("system");
    expect(initial.notificationsEnabled).toBe(true);
    expect(initial.isDeleting).toBe(false);
  });

  beforeEach(() => {
    useSettingsStore.setState({
      themePreference: "system",
      notificationsEnabled: true,
      isDeleting: false,
    });
  });

  test("setThemePreference updates state", () => {
    useSettingsStore.getState().setThemePreference("dark");
    expect(useSettingsStore.getState().themePreference).toBe("dark");
  });

  test("setThemePreference to light", () => {
    useSettingsStore.getState().setThemePreference("light");
    expect(useSettingsStore.getState().themePreference).toBe("light");
  });

  test("setNotificationsEnabled updates state", () => {
    useSettingsStore.getState().setNotificationsEnabled(false);
    expect(useSettingsStore.getState().notificationsEnabled).toBe(false);
  });
});
