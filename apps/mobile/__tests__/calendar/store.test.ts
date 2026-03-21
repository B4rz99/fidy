import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

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
  softDeleteTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn().mockResolvedValue(undefined),
}));

import { useCalendarStore } from "@/features/calendar/store";
import { useTransactionStore } from "@/features/transactions/store";

const mockDb = { transaction: (fn: (tx: unknown) => void) => fn(mockDb) } as never;
const mockUserId = "user-1" as UserId;
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
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    expect(result).toBe(true);
    expect(useCalendarStore.getState().bills).toHaveLength(1);
    const bill = useCalendarStore.getState().bills[0];
    expect(bill.name).toBe("Netflix");
    expect(bill.amount).toBe(35000);
    expect(bill.frequency).toBe("monthly");
    expect(bill.categoryId).toBe("services");
    expect(bill.isActive).toBe(true);
  });

  test("addBill returns false for empty name", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("", "35000", "monthly", "services" as CategoryId, testDate);
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill returns false for empty amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "", "monthly", "services" as CategoryId, testDate);
    expect(result).toBe(false);
  });

  test("addBill returns false for zero amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "0", "monthly", "services" as CategoryId, testDate);
    expect(result).toBe(false);
  });

  test("addBill strips non-digit chars and uses remaining digits", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "50.000", "monthly", "services" as CategoryId, testDate);
    expect(result).toBe(true);
    const bills = useCalendarStore.getState().bills;
    expect(bills[0].amount).toBe(50000);
  });

  test("addBill returns false for non-numeric amount", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "abc", "monthly", "services" as CategoryId, testDate);
    expect(result).toBe(false);
  });

  test("addBill validates frequency via schema", async () => {
    const result = await useCalendarStore
      .getState()
      // @ts-expect-error testing invalid frequency
      .addBill("Netflix", "35000", "daily", "services", testDate);
    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  test("addBill validates categoryId via schema", async () => {
    const result = await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "invalid" as CategoryId, testDate);
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
        id: "bill-1" as BillId,
        userId: "user-1" as UserId,
        name: "Netflix",
        amount: 35000 as CopAmount,
        frequency: "monthly",
        categoryId: "services" as CategoryId,
        startDate: "2026-01-15T00:00:00.000Z" as IsoDate,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-01-01T00:00:00.000Z" as IsoDateTime,
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

    await expect(useCalendarStore.getState().loadBills()).rejects.toThrow("DB error");

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
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);

    expect(result).toBe(false);
    expect(useCalendarStore.getState().bills).toHaveLength(0);
  });

  // ─── updateBill ───

  test("updateBill updates bill in state", async () => {
    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    await useCalendarStore.getState().updateBill(billId, { name: "Hulu" });

    const updated = useCalendarStore.getState().bills[0];
    expect(updated.name).toBe("Hulu");
  });

  test("updateBill converts startDate Date to ISO string for DB", async () => {
    const { updateBill: dbUpdateBill } = await import("@/features/calendar/lib/repository");
    vi.mocked(dbUpdateBill).mockClear();

    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;
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

    await useCalendarStore.getState().updateBill("bill-1" as BillId, { name: "Hulu" });

    expect(dbUpdateBill).not.toHaveBeenCalled();
  });

  // ─── deleteBill ───

  test("deleteBill removes bill and its payments from state", async () => {
    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    // Manually add a payment for this bill
    useCalendarStore.setState((s) => ({
      payments: [
        ...s.payments,
        {
          id: "pay-1" as BillPaymentId,
          billId,
          dueDate: "2026-03-15" as IsoDate,
          paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
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

    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    // Seed payment with a linked transaction
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-linked" as TransactionId,
          userId: "user-1" as UserId,
          type: "expense",
          amount: 35000 as CopAmount,
          categoryId: "services" as CategoryId,
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
          id: "pay-1" as BillPaymentId,
          billId,
          dueDate: "2026-03-15" as IsoDate,
          paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
          transactionId: "tx-linked" as TransactionId,
          createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
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

    await useCalendarStore.getState().deleteBill("bill-1" as BillId);

    expect(dbDeleteBill).not.toHaveBeenCalled();
  });

  // ─── markBillPaid ───

  test("markBillPaid adds payment to state and calls insertBillPayment", async () => {
    const { insertBillPayment } = await import("@/features/calendar/lib/repository");
    vi.mocked(insertBillPayment).mockClear();

    // Seed a bill so markBillPaid can look it up
    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15" as IsoDate);

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

    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15" as IsoDate);

    expect(insertTransaction).toHaveBeenCalledTimes(1);
    const txRow = vi.mocked(insertTransaction).mock.calls[0][1];
    expect(txRow.type).toBe("expense");
    expect(txRow.amount).toBe(35000);
    expect(txRow.categoryId).toBe("services");
    expect(txRow.description).toBe("Netflix");
  });

  test("markBillPaid stores transactionId on payment", async () => {
    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15" as IsoDate);

    const { payments } = useCalendarStore.getState();
    expect(payments[0].transactionId).toBeDefined();
    expect(payments[0].transactionId).toMatch(/^txn-/);
  });

  test("markBillPaid updates transaction store state", async () => {
    useTransactionStore.setState({ pages: [] });

    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15" as IsoDate);

    const txs = useTransactionStore.getState().pages;
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe("expense");
    expect(txs[0].amount).toBe(35000);
    expect(txs[0].description).toBe("Netflix");
  });

  test("markBillPaid enqueues sync for the transaction", async () => {
    const { enqueueSync } = await import("@/shared/db/enqueue-sync");
    vi.mocked(enqueueSync).mockClear();

    await useCalendarStore
      .getState()
      .addBill("Netflix", "35000", "monthly", "services" as CategoryId, testDate);
    const billId = useCalendarStore.getState().bills[0].id as BillId;

    await useCalendarStore.getState().markBillPaid(billId, "2026-03-15" as IsoDate);

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

    await useCalendarStore
      .getState()
      .markBillPaid("nonexistent-bill" as BillId, "2026-03-15" as IsoDate);

    expect(insertTransaction).not.toHaveBeenCalled();
    expect(useCalendarStore.getState().payments).toHaveLength(0);
  });

  test("markBillPaid does nothing without initStore", async () => {
    const { insertBillPayment } = await import("@/features/calendar/lib/repository");
    vi.mocked(insertBillPayment).mockClear();
    useCalendarStore.getState().initStore(null as never, null as never);

    await useCalendarStore.getState().markBillPaid("bill-1" as BillId, "2026-03-15" as IsoDate);

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
          id: "pay-1" as BillPaymentId,
          billId: "bill-1" as BillId,
          dueDate: "2026-03-15" as IsoDate,
          paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        },
      ],
    });

    await useCalendarStore.getState().unmarkBillPaid("bill-1" as BillId, "2026-03-15" as IsoDate);

    expect(useCalendarStore.getState().payments).toHaveLength(0);
    expect(deleteBillPayment).toHaveBeenCalledWith(mockDb, "bill-1", "2026-03-15");
  });

  test("unmarkBillPaid soft-deletes the linked transaction", async () => {
    const { softDeleteTransaction } = await import("@/features/transactions/lib/repository");
    const { enqueueSync } = await import("@/shared/db/enqueue-sync");
    vi.mocked(softDeleteTransaction).mockClear();
    vi.mocked(enqueueSync).mockClear();

    // Seed a payment with a transactionId
    useTransactionStore.setState({
      pages: [
        {
          id: "tx-linked" as TransactionId,
          userId: "user-1" as UserId,
          type: "expense",
          amount: 35000 as CopAmount,
          categoryId: "services" as CategoryId,
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
          id: "pay-1" as BillPaymentId,
          billId: "bill-1" as BillId,
          dueDate: "2026-03-15" as IsoDate,
          paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
          transactionId: "tx-linked" as TransactionId,
          createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        },
      ],
    });

    await useCalendarStore.getState().unmarkBillPaid("bill-1" as BillId, "2026-03-15" as IsoDate);

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

    await useCalendarStore.getState().unmarkBillPaid("bill-1" as BillId, "2026-03-15" as IsoDate);

    expect(deleteBillPayment).not.toHaveBeenCalled();
  });

  // ─── loadPaymentsForMonth ───

  test("loadPaymentsForMonth populates payments from DB", async () => {
    const { getBillPaymentsForMonth } = await import("@/features/calendar/lib/repository");
    vi.mocked(getBillPaymentsForMonth).mockResolvedValueOnce([
      {
        id: "pay-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-03-15" as IsoDate,
        paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        transactionId: null,
        createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
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
          id: "pay-existing" as BillPaymentId,
          billId: "bill-1" as BillId,
          dueDate: "2026-03-15" as IsoDate,
          paidAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
          transactionId: null,
          createdAt: "2026-03-10T00:00:00.000Z" as IsoDateTime,
        },
      ],
    });

    vi.mocked(getBillPaymentsForMonth).mockRejectedValueOnce(new Error("DB error"));

    await expect(useCalendarStore.getState().loadPaymentsForMonth()).rejects.toThrow("DB error");

    const { payments } = useCalendarStore.getState();
    expect(payments).toHaveLength(1);
    expect(payments[0].id).toBe("pay-existing");
  });
});
