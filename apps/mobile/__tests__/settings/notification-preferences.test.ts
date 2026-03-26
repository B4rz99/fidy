import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSettingsStore } from "@/features/settings/store";

const DEFAULT_PREFERENCES = {
  budgetAlerts: true,
  goalMilestones: true,
  spendingAnomalies: true,
  weeklyDigest: true,
} as const;

describe("notification preferences in settings store", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState());
    vi.clearAllMocks();
  });

  test("initial state has all preferences enabled", () => {
    const state = useSettingsStore.getState();
    expect(state.notificationPreferences).toEqual(DEFAULT_PREFERENCES);
  });

  test("areAllNotificationsOff returns false when all are on", () => {
    const state = useSettingsStore.getState();
    expect(state.areAllNotificationsOff).toBe(false);
  });

  test("areAllNotificationsOff returns true when all are off", () => {
    useSettingsStore.getState().setAllNotifications(false);
    expect(useSettingsStore.getState().areAllNotificationsOff).toBe(true);
  });

  test("areAllNotificationsOff returns false when at least one is on", () => {
    useSettingsStore.getState().setAllNotifications(false);
    useSettingsStore.getState().setNotificationPreference("goalMilestones", true);
    expect(useSettingsStore.getState().areAllNotificationsOff).toBe(false);
  });

  test("setNotificationPreference updates one preference", () => {
    useSettingsStore.getState().setNotificationPreference("budgetAlerts", false);
    const prefs = useSettingsStore.getState().notificationPreferences;
    expect(prefs.budgetAlerts).toBe(false);
    expect(prefs.goalMilestones).toBe(true);
    expect(prefs.spendingAnomalies).toBe(true);
    expect(prefs.weeklyDigest).toBe(true);
  });

  test("setNotificationPreference persists to SecureStore", async () => {
    useSettingsStore.getState().setNotificationPreference("weeklyDigest", false);
    // Allow microtask to flush
    await vi.waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "notification_preferences",
        expect.any(String)
      );
    });
    const calledWith = (SecureStore.setItemAsync as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "notification_preferences"
    );
    expect(calledWith).toBeDefined();
    const parsed = JSON.parse(calledWith?.[1] as string);
    expect(parsed.weeklyDigest).toBe(false);
  });

  test("setAllNotifications(false) sets all four to false", () => {
    useSettingsStore.getState().setAllNotifications(false);
    expect(useSettingsStore.getState().notificationPreferences).toEqual({
      budgetAlerts: false,
      goalMilestones: false,
      spendingAnomalies: false,
      weeklyDigest: false,
    });
  });

  test("setAllNotifications(true) sets all four to true", () => {
    useSettingsStore.getState().setAllNotifications(false);
    useSettingsStore.getState().setAllNotifications(true);
    expect(useSettingsStore.getState().notificationPreferences).toEqual(DEFAULT_PREFERENCES);
  });

  test("setAllNotifications persists to SecureStore", async () => {
    useSettingsStore.getState().setAllNotifications(false);
    await vi.waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "notification_preferences",
        expect.any(String)
      );
    });
  });

  test("hydrate restores notification preferences from SecureStore", async () => {
    const stored = JSON.stringify({
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
      weeklyDigest: true,
    });
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
      if (key === "notification_preferences") return stored;
      return null;
    });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().notificationPreferences).toEqual({
      budgetAlerts: false,
      goalMilestones: true,
      spendingAnomalies: false,
      weeklyDigest: true,
    });
  });

  test("hydrate uses defaults when SecureStore returns null", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().notificationPreferences).toEqual(DEFAULT_PREFERENCES);
  });
});
