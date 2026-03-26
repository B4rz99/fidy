import { beforeEach, describe, expect, test } from "vitest";
import { useSettingsStore } from "@/features/settings/store";

describe("useSettingsStore", () => {
  test("has correct initial defaults", () => {
    // Mutate to non-defaults first to prove getInitialState is independent
    useSettingsStore.setState({
      themePreference: "dark",
      isDeleting: true,
    });
    const initial = useSettingsStore.getInitialState();
    expect(initial.themePreference).toBe("system");
    expect(initial.notificationPreferences).toEqual({
      budgetAlerts: true,
      goalMilestones: true,
      spendingAnomalies: true,
      weeklyDigest: true,
    });
    expect(initial.isDeleting).toBe(false);
  });

  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState());
  });

  test("setThemePreference updates state", () => {
    useSettingsStore.getState().setThemePreference("dark");
    expect(useSettingsStore.getState().themePreference).toBe("dark");
  });

  test("setThemePreference to light", () => {
    useSettingsStore.getState().setThemePreference("light");
    expect(useSettingsStore.getState().themePreference).toBe("light");
  });

  test("setNotificationPreference updates one preference", () => {
    useSettingsStore.getState().setNotificationPreference("budgetAlerts", false);
    expect(useSettingsStore.getState().notificationPreferences.budgetAlerts).toBe(false);
    expect(useSettingsStore.getState().notificationPreferences.goalMilestones).toBe(true);
  });
});
