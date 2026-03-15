import { beforeEach, describe, expect, test, vi } from "vitest";

vi.unmock("date-fns");

// Mock the calendar repository module
vi.mock("@/features/calendar/lib/repository", () => ({
  insertBill: vi.fn().mockResolvedValue(undefined),
  getAllBills: vi.fn().mockResolvedValue([]),
  updateBill: vi.fn().mockResolvedValue(undefined),
  deleteBill: vi.fn().mockResolvedValue(undefined),
  insertBillPayment: vi.fn().mockResolvedValue(undefined),
  getBillPaymentsForMonth: vi.fn().mockResolvedValue([]),
  deleteBillPayment: vi.fn().mockResolvedValue(undefined),
}));

// Mock the transaction repository module
vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: vi.fn().mockResolvedValue(undefined),
  enqueueSync: vi.fn().mockResolvedValue(undefined),
  softDeleteTransaction: vi.fn().mockResolvedValue(undefined),
}));

import { useCalendarStore } from "@/features/calendar/store";
import { useTransactionStore } from "@/features/transactions/store";

const mockDb = { transaction: (fn: (tx: unknown) => void) => fn(mockDb) } as never;
const mockUserId = "user-1";
const testDate = new Date(2026, 2, 15);

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
      .addBill("Netflix", "15.99", "monthly", "services", testDate);
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
    const result = await useCalendarStore
      .getState()
      .addBill("", "15.99", "monthly", "services", testDate);
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill returns false for empty amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "", "monthly", "services", testDate);
    expect(result).toBe(false);
  });

  test("addBill returns false for zero amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "0", "monthly", "services", testDate);
    expect(result).toBe(false);
  });

  test("addBill returns false for negative amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "-5", "monthly", "services", testDate);
    expect(result).toBe(false);
  });

  test("addBill returns false for non-numeric amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "abc", "monthly", "services", testDate);
    expect(result).toBe(false);
  });

  test("addBill validates frequency via schema", async () => {
    const result = await useCalendarStore
      .getState()
      // @ts-expect-error testing invalid frequency
      .addBill("Netflix", "15.99", "daily", "services", testDate);
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill validates categoryId via schema", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "15.99", "monthly", "invalid", testDate);
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

  // ─── loadBills ───

  test("loadBills populates bills from DB rows", async () => {
    const { getAllBills } = await import("@/features/calendar/lib/repository");
    vi.mocked(getAllBills).mockResolvedValueOnce([
      {
        id: "bill-1",
        userId: "user-1",
        name: "Netflix",
        amountCents: 1599,
        frequency: "monthly",
        categoryId: "services",
        startDate: "2026-01-15T00:00:00.000Z",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await useCalendarStore.getState().loadBills();

    const { bills, isLoading } = useCalendarStore.getState();
    expect(isLoading).toBe(false);
    expect(bills).toHaveLength(1);
    expect(bills[0].name).toBe("Netflix");
    expect(bills[0].startDate).toBeInstanceOf(Date);
    expect(bills[0].isActive).toBe(true);
  });

  test("loadBills sets isLoading false on error", async () => {
    const { getAllBills } = await import("@/features/calendar/lib/repository");
    vi.mocked(getAllBills).mockRejectedValueOnce(new Error("DB error"));

    await useCalendarStore.getState().loadBills();

    expect(useCalendarStore.getState().isLoading).toBe(false);
  });

  test("loadBills does nothing without initStore", async () => {
    const { getAllBills } = await import("@/features/calendar/lib/repository");
    vi.mocked(getAllBills).mockClear();
    useCalendarStore.getState().initStore(null as never, null as never);

    await useCalendarStore.getState().loadBills();

    expect(getAllBills).not.toHaveBeenCalled();
  });

  // ─── addBill error path ───

  test("addBill returns false when insertBill throws", async () => {
    const { insertBill } = await import("@/features/calendar/lib/repository");
    vi.mocked(insertBill).mockRejectedValueOnce(new Error("DB write error"));

    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "15.99", "monthly", "services", testDate);

    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  // ─── updateBill ───

  test("updateBill updates bill in state", async () => {
    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    await useCalendarStore.getState().updateBill(billId, { name: "Hulu" });

    const updated = useCalendarStore.getState().bills[0];
    expect(updated.name).toBe("Hulu");
  });

  test("updateBill converts startDate Date to ISO string for DB", async () => {
    const { updateBill: dbUpdateBill } = await import("@/features/calendar/lib/repository");
    vi.mocked(dbUpdateBill).mockClear();

    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;
    const newDate = new Date("2026-06-01T00:00:00.000Z");

    await useCalendarStore.getState().updateBill(billId, { startDate: newDate });

    expect(dbUpdateBill).toHaveBeenCalledWith(
      mockDb,
      billId,
      expect.objectContaining({ startDate: "2026-06-01T00:00:00.000Z" }),
      expect.any(String)
    );
  });

  test("updateBill does nothing without initStore", async () => {
    const { updateBill: dbUpdateBill } = await import("@/features/calendar/lib/repository");
    vi.mocked(dbUpdateBill).mockClear();
    useCalendarStore.getState().initStore(null as never, null as never);

    await useCalendarStore.getState().updateBill("bill-1", { name: "Hulu" });

    expect(dbUpdateBill).not.toHaveBeenCalled();
  });

  // ─── deleteBill ───

  test("deleteBill removes bill and its payments from state", async () => {
    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    // Manually add a payment for this bill
    useCalendarStore.setState((s) => ({
      payments: [
        ...s.payments,
        {
          id: "pay-1",
          billId,
          dueDate: "2026-03-15",
          paidAt: "2026-03-10T00:00:00.000Z",
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    }));

    await useCalendarStore.getState().deleteBill(billId);

    expect(useCalendarStore.getState().bills).toHaveLength(0);
    expect(useCalendarStore.getState().payments).toHaveLength(0);
  });

  test("deleteBill preserves linked transactions", async () => {
    const { softDeleteTransaction } = await import("@/features/transactions/lib/repository");
    vi.mocked(softDeleteTransaction).mockClear();

    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    // Seed payment with a linked transaction
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-linked",
          userId: "user-1",
          type: "expense",
          amountCents: 1599,
          categoryId: "services",
          description: "Netflix",
          date: new Date(2026, 2, 15),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });
    useCalendarStore.setState((s) => ({
      payments: [
        ...s.payments,
        {
          id: "pay-1",
          billId,
          dueDate: "2026-03-15",
          paidAt: "2026-03-10T00:00:00.000Z",
          transactionId: "tx-linked",
          createdAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    }));

    await useCalendarStore.getState().deleteBill(billId);

    // Past transactions should NOT be deleted — they represent real expenses
    expect(softDeleteTransaction).not.toHaveBeenCalled();
    expect(useTransactionStore.getState().pages).toHaveLength(1);
  });

  test("deleteBill does nothing without initStore", async () => {
    const { deleteBill: dbDeleteBill } = await import("@/features/calendar/lib/repository");
    vi.mocked(dbDeleteBill).mockClear();
    useCalendarStore.getState().initStore(null as never, null as never);

    await useCalendarStore.getState().deleteBill("bill-1");

    expect(dbDeleteBill).not.toHaveBeenCalled();
  });

  // ─── markBillPaid ───

  test("markBillPaid adds payment to state and calls insertBillPayment", async () => {
    const { insertBillPayment } = await import("@/features/calendar/lib/repository");
    vi.mocked(insertBillPayment).mockClear();

    // Seed a bill so markBillPaid can look it up
    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15");

    const { payments } = useCalendarStore.getState();
    expect(payments).toHaveLength(1);
    expect(payments[0].billId).toBe(billId);
    expect(payments[0].dueDate).toBe("2026-03-15");
    expect(payments[0].paidAt).toBeDefined();
    expect(insertBillPayment).toHaveBeenCalledTimes(1);
  });

  test("markBillPaid creates an expense transaction", async () => {
    const { insertTransaction } = await import("@/features/transactions/lib/repository");
    vi.mocked(insertTransaction).mockClear();

    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15");

    expect(insertTransaction).toHaveBeenCalledTimes(1);
    const txRow = vi.mocked(insertTransaction).mock.calls[0][1];
    expect(txRow.type).toBe("expense");
    expect(txRow.amountCents).toBe(1599);
    expect(txRow.categoryId).toBe("services");
    expect(txRow.description).toBe("Netflix");
  });

  test("markBillPaid stores transactionId on payment", async () => {
    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15");

    const { payments } = useCalendarStore.getState();
    expect(payments[0].transactionId).toBeDefined();
    expect(payments[0].transactionId).toMatch(/^tx-/);
  });

  test("markBillPaid updates transaction store state", async () => {
    useTransactionStore.setState({ pages: [] });

    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15");

    const txs = useTransactionStore.getState().pages;
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe("expense");
    expect(txs[0].amountCents).toBe(1599);
    expect(txs[0].description).toBe("Netflix");
  });

  test("markBillPaid enqueues sync for the transaction", async () => {
    const { enqueueSync } = await import("@/features/transactions/lib/repository");
    vi.mocked(enqueueSync).mockClear();

    await useCalendarStore.getState().addBill("Netflix", "15.99", "monthly", "services", testDate);
    const billId = useCalendarStore.getState().bills[0].id;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15");

    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        operation: "insert",
      })
    );
  });

  test("markBillPaid does nothing when bill not found", async () => {
    const { insertTransaction } = await import("@/features/transactions/lib/repository");
    vi.mocked(insertTransaction).mockClear();

    await useCalendarStore.getState().markBillPaid("nonexistent-bill", "2026-03-15");

    expect(insertTransaction).not.toHaveBeenCalled();
    expect(useCalendarStore.getState().payments).toHaveLength(0);
  });

  test("markBillPaid does nothing without initStore", async () => {
    const { insertBillPayment } = await import("@/features/calendar/lib/repository");
    vi.mocked(insertBillPayment).mockClear();
    useCalendarStore.getState().initStore(null as never, null as never);

    await useCalendarStore.getState().markBillPaid("bill-1", "2026-03-15");

    expect(insertBillPayment).not.toHaveBeenCalled();
    expect(useCalendarStore.getState().payments).toHaveLength(0);
  });

  // ─── unmarkBillPaid ───

  test("unmarkBillPaid removes matching payment from state", async () => {
    const { deleteBillPayment } = await import("@/features/calendar/lib/repository");
    vi.mocked(deleteBillPayment).mockClear();

    // Seed a payment in state
    useCalendarStore.setState({
      payments: [
        {
          id: "pay-1",
          billId: "bill-1",
          dueDate: "2026-03-15",
          paidAt: "2026-03-10T00:00:00.000Z",
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    });

    await useCalendarStore.getState().unmarkBillPaid("bill-1", "2026-03-15");

    expect(useCalendarStore.getState().payments).toHaveLength(0);
    expect(deleteBillPayment).toHaveBeenCalledWith(mockDb, "bill-1", "2026-03-15");
  });

  test("unmarkBillPaid soft-deletes the linked transaction", async () => {
    const { softDeleteTransaction } = await import("@/features/transactions/lib/repository");
    const { enqueueSync } = await import("@/features/transactions/lib/repository");
    vi.mocked(softDeleteTransaction).mockClear();
    vi.mocked(enqueueSync).mockClear();

    // Seed a payment with a transactionId
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-linked",
          userId: "user-1",
          type: "expense",
          amountCents: 1599,
          categoryId: "services",
          description: "Netflix",
          date: new Date(2026, 2, 15),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    });
    useCalendarStore.setState({
      payments: [
        {
          id: "pay-1",
          billId: "bill-1",
          dueDate: "2026-03-15",
          paidAt: "2026-03-10T00:00:00.000Z",
          transactionId: "tx-linked",
          createdAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    });

    await useCalendarStore.getState().unmarkBillPaid("bill-1", "2026-03-15");

    expect(softDeleteTransaction).toHaveBeenCalledWith(mockDb, "tx-linked", expect.any(String));
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        rowId: "tx-linked",
        operation: "delete",
      })
    );
    expect(useTransactionStore.getState().pages).toHaveLength(0);
  });

  test("unmarkBillPaid does nothing without initStore", async () => {
    const { deleteBillPayment } = await import("@/features/calendar/lib/repository");
    vi.mocked(deleteBillPayment).mockClear();
    useCalendarStore.getState().initStore(null as never, null as never);

    await useCalendarStore.getState().unmarkBillPaid("bill-1", "2026-03-15");

    expect(deleteBillPayment).not.toHaveBeenCalled();
  });

  // ─── loadPaymentsForMonth ───

  test("loadPaymentsForMonth populates payments from DB", async () => {
    const { getBillPaymentsForMonth } = await import("@/features/calendar/lib/repository");
    vi.mocked(getBillPaymentsForMonth).mockResolvedValueOnce([
      {
        id: "pay-1",
        billId: "bill-1",
        dueDate: "2026-03-15",
        paidAt: "2026-03-10T00:00:00.000Z",
        transactionId: null,
        createdAt: "2026-03-10T00:00:00.000Z",
      },
    ]);

    await useCalendarStore.getState().loadPaymentsForMonth();

    const { payments } = useCalendarStore.getState();
    expect(payments).toHaveLength(1);
    expect(payments[0].billId).toBe("bill-1");
  });

  test("loadPaymentsForMonth preserves existing payments on error", async () => {
    const { getBillPaymentsForMonth } = await import("@/features/calendar/lib/repository");

    // Seed existing payments
    useCalendarStore.setState({
      payments: [
        {
          id: "pay-existing",
          billId: "bill-1",
          dueDate: "2026-03-15",
          paidAt: "2026-03-10T00:00:00.000Z",
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    });

    vi.mocked(getBillPaymentsForMonth).mockRejectedValueOnce(new Error("DB error"));

    await useCalendarStore.getState().loadPaymentsForMonth();

    const { payments } = useCalendarStore.getState();
    expect(payments).toHaveLength(1);
    expect(payments[0].id).toBe("pay-existing");
  });
});
