import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetAlert } from "@/features/budget/lib/derive";
import type { BudgetId, CategoryId, CopAmount } from "@/shared/types/branded";

// --- expo-secure-store mock ---
const mockGetItemAsync = vi.fn(() => Promise.resolve(null));

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: vi.fn(() => Promise.resolve()),
}));

// --- expo-notifications mock ---
const mockGetPermissionsAsync = vi.fn(() =>
  Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
);
const mockScheduleNotificationAsync = vi.fn(() => Promise.resolve("notif-id-123"));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted", granted: true, canAskAgain: true })
  ),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: "ExponentPushToken[mock]" })),
  addPushTokenListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
}));

const MOCK_ALERT: BudgetAlert = {
  budgetId: "budget-1" as BudgetId,
  categoryId: "food" as CategoryId,
  threshold: 80,
  percentUsed: 85,
  suggestionKey: undefined,
  daysLeft: 10,
  remainingAmount: 50000 as CopAmount,
};

describe("scheduleBudgetAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null); // hasSeenPrePermission = false
    mockGetPermissionsAsync.mockResolvedValue({
      status: "granted",
      granted: true,
      canAskAgain: true,
    });
    mockScheduleNotificationAsync.mockResolvedValue("notif-id-123");
  });

  it("returns { type: 'scheduled', id } when permission is granted", async () => {
    const { scheduleBudgetAlert } = await import("@/features/budget/lib/notifications");

    const result = await scheduleBudgetAlert(MOCK_ALERT, "Food");

    expect(result).toEqual({ type: "scheduled", id: "notif-id-123" });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledOnce();
  });

  it("returns { type: 'needs_permission' } when pre-permission is needed", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      granted: false,
      canAskAgain: true,
    });
    // hasSeenPrePermission = false (default)

    const { scheduleBudgetAlert } = await import("@/features/budget/lib/notifications");

    const result = await scheduleBudgetAlert(MOCK_ALERT, "Food");

    expect(result).toEqual({ type: "needs_permission" });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("returns { type: 'skipped' } when permission is denied", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: "denied",
      granted: false,
      canAskAgain: false,
    });

    const { scheduleBudgetAlert } = await import("@/features/budget/lib/notifications");

    const result = await scheduleBudgetAlert(MOCK_ALERT, "Food");

    expect(result).toEqual({ type: "skipped" });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("returns { type: 'skipped' } when undetermined but already seen pre-permission", async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      granted: false,
      canAskAgain: true,
    });
    mockGetItemAsync.mockResolvedValue("true"); // hasSeenPrePermission = true

    const { scheduleBudgetAlert } = await import("@/features/budget/lib/notifications");

    const result = await scheduleBudgetAlert(MOCK_ALERT, "Food");

    expect(result).toEqual({ type: "skipped" });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("returns { type: 'skipped' } when notificationsEnabled is false", async () => {
    const { scheduleBudgetAlert } = await import("@/features/budget/lib/notifications");

    const result = await scheduleBudgetAlert(MOCK_ALERT, "Food", false);

    expect(result).toEqual({ type: "skipped" });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
