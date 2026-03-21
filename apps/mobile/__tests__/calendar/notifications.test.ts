import { describe, expect, test, vi } from "vitest";

vi.unmock("date-fns");

import {
  cancelBillNotifications,
  computeUpcomingOccurrences,
  requestNotificationPermissions,
  scheduleBillNotifications,
} from "@/features/calendar/lib/notifications";
import type { Bill } from "@/features/calendar/schema";
import type { CategoryId } from "@/shared/types/branded";

const makeBill = (overrides: Partial<Bill> = {}): Bill => ({
  id: "bill-1",
  name: "Netflix",
  amount: 35000,
  frequency: "monthly",
  categoryId: "services" as CategoryId,
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

describe("scheduleBillNotifications (no-op)", () => {
  test("returns empty array", async () => {
    const bill = makeBill();
    const ids = await scheduleBillNotifications(bill);
    expect(ids).toEqual([]);
  });
});

describe("cancelBillNotifications (no-op)", () => {
  test("resolves without error", async () => {
    await expect(cancelBillNotifications(["id-a", "id-b"])).resolves.toBeUndefined();
  });
});

describe("requestNotificationPermissions (no-op)", () => {
  test("returns false", async () => {
    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });
});
