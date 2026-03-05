import { beforeEach, describe, expect, test, vi } from "vitest";

vi.unmock("date-fns");

import { useCalendarStore } from "@/features/calendar/store";

describe("useCalendarStore", () => {
  beforeEach(() => {
    useCalendarStore.setState({
      currentMonth: new Date(2026, 2, 1),
      bills: [],
      selectedBillId: null,
      popup: "none",
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

  // ─── Popup management ───

  test("openAddBill sets popup to addBill", () => {
    useCalendarStore.getState().openAddBill();
    expect(useCalendarStore.getState().popup).toBe("addBill");
  });

  test("openBillDetail sets popup and selectedBillId", () => {
    useCalendarStore.getState().openBillDetail("bill-1");
    const state = useCalendarStore.getState();
    expect(state.popup).toBe("billDetail");
    expect(state.selectedBillId).toBe("bill-1");
  });

  test("closePopup resets popup and selectedBillId", () => {
    useCalendarStore.getState().openBillDetail("bill-1");
    useCalendarStore.getState().closePopup();
    const state = useCalendarStore.getState();
    expect(state.popup).toBe("none");
    expect(state.selectedBillId).toBeNull();
  });

  // ─── addBill ───

  test("addBill with valid data adds bill and returns true", () => {
    const result = useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "bills");
    expect(result).toBe(true);
    expect(useCalendarStore.getState().bills).toHaveLength(1);
    const bill = useCalendarStore.getState().bills[0];
    expect(bill.name).toBe("Netflix");
    expect(bill.amountCents).toBe(1599);
    expect(bill.frequency).toBe("monthly");
    expect(bill.categoryId).toBe("bills");
    expect(bill.isActive).toBe(true);
  });

  test("addBill closes popup on success", () => {
    useCalendarStore.getState().openAddBill();
    useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "bills");
    expect(useCalendarStore.getState().popup).toBe("none");
  });

  // Bug 2: addBill should return false on validation failure
  test("addBill returns false for empty name", () => {
    const result = useCalendarStore.getState().addBill("", "15.99", "monthly", "bills");
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill returns false for empty amount", () => {
    const result = useCalendarStore.getState().addBill("Netflix", "", "monthly", "bills");
    expect(result).toBe(false);
  });

  test("addBill returns false for zero amount", () => {
    const result = useCalendarStore.getState().addBill("Netflix", "0", "monthly", "bills");
    expect(result).toBe(false);
  });

  test("addBill returns false for negative amount", () => {
    const result = useCalendarStore.getState().addBill("Netflix", "-5", "monthly", "bills");
    expect(result).toBe(false);
  });

  test("addBill returns false for non-numeric amount", () => {
    const result = useCalendarStore.getState().addBill("Netflix", "abc", "monthly", "bills");
    expect(result).toBe(false);
  });

  // Bug 3: addBill should validate through createBillSchema (frequency + categoryId)
  test("addBill validates frequency via schema", () => {
    // @ts-expect-error testing invalid frequency
    const result = useCalendarStore.getState().addBill("Netflix", "15.99", "daily", "bills");
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill validates categoryId via schema", () => {
    // @ts-expect-error testing invalid categoryId
    const result = useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "invalid");
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });
});
