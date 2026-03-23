import * as Notifications from "expo-notifications";
import { beforeEach, describe, expect, test, vi } from "vitest";
// Import after mocks are set up by setup.ts
import { scheduleLocalPush } from "@/features/notifications/services/local-push";
import { useSettingsStore } from "@/features/settings/store";

describe("scheduleLocalPush", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState());
    vi.clearAllMocks();
  });

  test("returns notification ID when preference is enabled", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("notif-123");

    const result = await scheduleLocalPush({
      title: "Budget warning",
      body: "Food is at 80%",
      preferenceKey: "budgetAlerts",
    });

    expect(result).toBe("notif-123");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Budget warning",
        body: "Food is at 80%",
        data: undefined,
      },
      trigger: null,
    });
  });

  test("returns null when preference is disabled", async () => {
    useSettingsStore.getState().setNotificationPreference("budgetAlerts", false);

    const result = await scheduleLocalPush({
      title: "Budget warning",
      body: "Food is at 80%",
      preferenceKey: "budgetAlerts",
    });

    expect(result).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test("returns null on scheduling error", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockRejectedValue(
      new Error("Permission denied")
    );

    const result = await scheduleLocalPush({
      title: "Goal milestone",
      body: "50% saved!",
      preferenceKey: "goalMilestones",
    });

    expect(result).toBeNull();
  });

  test("passes data through when provided", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("notif-456");

    await scheduleLocalPush({
      title: "Spending alert",
      body: "Unusual spending",
      data: { route: "/notifications", type: "spending_anomaly" },
      preferenceKey: "spendingAnomalies",
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "Spending alert",
        body: "Unusual spending",
        data: { route: "/notifications", type: "spending_anomaly" },
      },
      trigger: null,
    });
  });

  test("checks the correct preference key for each type", async () => {
    vi.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue("notif-789");

    // Disable only weeklyDigest
    useSettingsStore.getState().setNotificationPreference("weeklyDigest", false);

    // budgetAlerts should still work
    const budgetResult = await scheduleLocalPush({
      title: "Budget alert",
      body: "test",
      preferenceKey: "budgetAlerts",
    });
    expect(budgetResult).toBe("notif-789");

    // weeklyDigest should be blocked
    const digestResult = await scheduleLocalPush({
      title: "Weekly digest",
      body: "test",
      preferenceKey: "weeklyDigest",
    });
    expect(digestResult).toBeNull();
  });
});
