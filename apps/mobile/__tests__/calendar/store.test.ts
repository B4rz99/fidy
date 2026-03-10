import { beforeEach, describe, expect, test, vi } from "vitest";

vi.unmock("date-fns");

vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync: vi.fn().mockResolvedValue("notif-1"),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  // biome-ignore lint/style/useNamingConvention: expo-notifications API uses PascalCase enum
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

// Mock the repository module
vi.mock("@/features/calendar/lib/repository", () => ({
  insertBill: vi.fn().mockResolvedValue(undefined),
  getAllBills: vi.fn().mockResolvedValue([]),
  updateBill: vi.fn().mockResolvedValue(undefined),
  deleteBill: vi.fn().mockResolvedValue(undefined),
  insertBillPayment: vi.fn().mockResolvedValue(undefined),
  getBillPaymentsForMonth: vi.fn().mockResolvedValue([]),
  deleteBillPayment: vi.fn().mockResolvedValue(undefined),
}));

import { useCalendarStore } from "@/features/calendar/store";

const mockDb = {} as never;
const mockUserId = "user-1";

describe("useCalendarStore", () => {
  beforeEach(() => {
    useCalendarStore.getState().initStore(mockDb, mockUserId);
    useCalendarStore.setState({
      currentMonth: new Date(2026, 2, 1),
      bills: [],
      payments: [],
      isLoading: false,
    });
  });

  // ─── Navigation ───

  test("nextMonth advances by one month", () => {
    useCalendarStore.getState().nextMonth();
    expect(useCalendarStore.getState().currentMonth.getMonth()).toBe(3);
  });

  test("prevMonth goes back by one month", () => {
    useCalendarStore.getState().prevMonth();
    expect(useCalendarStore.getState().currentMonth.getMonth()).toBe(1);
  });

  // ─── initStore ───

  test("initStore sets module-level refs", () => {
    // After initStore, addBill should not fail with "Store not initialized"
    expect(() => useCalendarStore.getState().initStore(mockDb, mockUserId)).not.toThrow();
  });

  // ─── addBill ───

  test("addBill with valid data adds bill and returns true", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "15.99", "monthly", "services");
    expect(result).toBe(true);
    expect(useCalendarStore.getState().bills).toHaveLength(1);
    const bill = useCalendarStore.getState().bills[0];
    expect(bill.name).toBe("Netflix");
    expect(bill.amountCents).toBe(1599);
    expect(bill.frequency).toBe("monthly");
    expect(bill.categoryId).toBe("services");
    expect(bill.isActive).toBe(true);
  });

  test("addBill returns false for empty name", async () => {
    const result = await useCalendarStore.getState().addBill("", "15.99", "monthly", "services");
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill returns false for empty amount", async () => {
    const result = await useCalendarStore.getState().addBill("Netflix", "", "monthly", "services");
    expect(result).toBe(false);
  });

  test("addBill returns false for zero amount", async () => {
    const result = await useCalendarStore.getState().addBill("Netflix", "0", "monthly", "services");
    expect(result).toBe(false);
  });

  test("addBill returns false for negative amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "-5", "monthly", "services");
    expect(result).toBe(false);
  });

  test("addBill returns false for non-numeric amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "abc", "monthly", "services");
    expect(result).toBe(false);
  });

  test("addBill validates frequency via schema", async () => {
    const result = await useCalendarStore
      .getState()
      // @ts-expect-error testing invalid frequency
      .addBill("Netflix", "15.99", "daily", "services");
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill validates categoryId via schema", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "15.99", "monthly", "invalid");
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  // ─── State shape ───

  test("has payments array in state", () => {
    expect(useCalendarStore.getState().payments).toEqual([]);
  });

  test("has isLoading in state", () => {
    expect(useCalendarStore.getState().isLoading).toBe(false);
  });

  // ─── No popup state ───

  test("does not have popup state", () => {
    expect("popup" in useCalendarStore.getState()).toBe(false);
  });

  test("does not have selectedBillId state", () => {
    expect("selectedBillId" in useCalendarStore.getState()).toBe(false);
  });
});
