import { beforeEach, describe, expect, test } from "vitest";
import { useSettingsStore } from "@/features/settings/store";

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      themePreference: "system",
      notificationsEnabled: true,
      isDeleting: false,
    });
  });

  test("default themePreference is system", () => {
    expect(useSettingsStore.getState().themePreference).toBe("system");
  });

  test("default notificationsEnabled is true", () => {
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
  });

  test("default isDeleting is false", () => {
    expect(useSettingsStore.getState().isDeleting).toBe(false);
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
