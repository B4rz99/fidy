import { describe, expect, test, vi } from "vitest";

vi.unmock("date-fns");

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn().mockResolvedValue("notif-1"),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  // biome-ignore lint/style/useNamingConvention: expo-notifications API uses PascalCase enum
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

import * as Notifications from "expo-notifications";
import {
  cancelBillNotifications,
  computeUpcomingOccurrences,
  requestNotificationPermissions,
  scheduleBillNotifications,
} from "@/features/calendar/lib/notifications";
import type { Bill } from "@/features/calendar/schema";

const makeBill = (overrides: Partial<Bill> = {}): Bill => ({
  id: "bill-1",
  name: "Netflix",
  amountCents: 1599,
  frequency: "monthly",
  categoryId: "services",
  startDate: new Date(2025, 0, 15),
  isActive: true,
  ...overrides,
});

describe("computeUpcomingOccurrences", () => {
  test("returns correct number of occurrences", () => {
    const bill = makeBill();
    const occurrences = computeUpcomingOccurrences(bill, 3, new Date(2025, 5, 1));
    expect(occurrences).toHaveLength(3);
  });

  test("returns dates in the future from the given reference", () => {
    const bill = makeBill({ startDate: new Date(2025, 0, 15) });
    const from = new Date(2025, 5, 1);
    const occurrences = computeUpcomingOccurrences(bill, 3, from);
    for (const date of occurrences) {
      expect(date.getTime()).toBeGreaterThanOrEqual(from.getTime());
    }
  });

  test("returns monthly occurrences for monthly frequency", () => {
    const bill = makeBill({ frequency: "monthly", startDate: new Date(2025, 0, 15) });
    const occurrences = computeUpcomingOccurrences(bill, 3, new Date(2025, 0, 15));
    expect(occurrences[0].getDate()).toBe(15);
    expect(occurrences[1].getDate()).toBe(15);
    expect(occurrences[2].getDate()).toBe(15);
  });

  test("returns weekly occurrences for weekly frequency", () => {
    const bill = makeBill({ frequency: "weekly", startDate: new Date(2025, 0, 6) }); // Monday
    const occurrences = computeUpcomingOccurrences(bill, 3, new Date(2025, 0, 6));
    // Each occurrence should be 7 days apart
    expect(occurrences[1].getTime() - occurrences[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(occurrences[2].getTime() - occurrences[1].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("returns yearly occurrences for yearly frequency", () => {
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2025, 2, 22) });
    const occurrences = computeUpcomingOccurrences(bill, 3, new Date(2025, 2, 22));
    expect(occurrences[0].getFullYear()).toBe(2025);
    expect(occurrences[1].getFullYear()).toBe(2026);
    expect(occurrences[2].getFullYear()).toBe(2027);
  });

  test("returns empty array for 0 count", () => {
    const bill = makeBill();
    expect(computeUpcomingOccurrences(bill, 0, new Date())).toEqual([]);
  });
});

describe("scheduleBillNotifications", () => {
  test("returns notification IDs from scheduleNotificationAsync", async () => {
    const bill = makeBill({ startDate: new Date(2099, 0, 15) });
    const ids = await scheduleBillNotifications(bill);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toBe("notif-1");
    }
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });
});

describe("cancelBillNotifications", () => {
  test("calls cancelScheduledNotificationAsync for each ID", async () => {
    const ids = ["id-a", "id-b", "id-c"];
    await cancelBillNotifications(ids);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(ids.length);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("id-a");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("id-b");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("id-c");
  });
});

describe("requestNotificationPermissions", () => {
  test("returns true immediately when already granted", async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({
      status: "granted",
    } as never);
    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test("requests permissions and returns true when granted after prompt", async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({
      status: "undetermined",
    } as never);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({
      status: "granted",
    } as never);
    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  test("returns false when permissions denied", async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({
      status: "denied",
    } as never);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({
      status: "denied",
    } as never);
    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });
});
