import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDb } from "@/shared/db";
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

const insertTransaction = vi.fn();
const upsertTransaction = vi.fn();
const softDeleteTransaction = vi.fn();
const insertBill = vi.fn();
const insertBillPayment = vi.fn();
const deleteBillPayment = vi.fn();
const deleteBill = vi.fn();
const updateBill = vi.fn();
const insertUserCategory = vi.fn();
const insertGoal = vi.fn();
const insertContribution = vi.fn();
const softDeleteGoal = vi.fn();
const softDeleteContribution = vi.fn();
const updateGoal = vi.fn();
const insertBudget = vi.fn();
const updateBudgetAmount = vi.fn();
const softDeleteBudget = vi.fn();
const copyBudgetsToMonth = vi.fn(() => []);
const insertNotification = vi.fn(() => ({ changes: 1 }));
const getAllNotificationIds = vi.fn(() => []);
const softDeleteAllNotifications = vi.fn();
const enqueueSync = vi.fn();

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction,
  upsertTransaction,
  softDeleteTransaction,
}));

vi.mock("@/features/calendar/lib/repository", () => ({
  insertBill,
  insertBillPayment,
  deleteBillPayment,
  deleteBill,
  updateBill,
}));

vi.mock("@/features/categories/lib/repository", () => ({
  insertUserCategory,
}));

vi.mock("@/features/goals/lib/repository", () => ({
  insertGoal,
  insertContribution,
  softDeleteGoal,
  softDeleteContribution,
  updateGoal,
}));

vi.mock("@/features/budget/lib/repository", () => ({
  insertBudget,
  updateBudgetAmount,
  softDeleteBudget,
  copyBudgetsToMonth,
}));

vi.mock("@/features/notifications/repository", () => ({
  insertNotification,
  getAllNotificationIds,
  softDeleteAllNotifications,
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync,
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib")>("@/shared/lib");
  return {
    ...actual,
    generateBudgetId: vi.fn(() => "budget-generated"),
    generateSyncQueueId: vi.fn(() => "sync-generated"),
  };
});

const mockDb = {
  transaction: vi.fn((fn: (tx: AnyDb) => unknown) => fn(mockDb as AnyDb)),
} as unknown as AnyDb;

async function loadModule() {
  return import("@/mutations");
}

describe("app write-through mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues sync for transaction saves", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const module = createWriteThroughMutationModule(mockDb);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    const result = await module.commit({
      kind: "transaction.save",
      mode: "insert",
      row: {
        id: "tx-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 1200 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        date: "2026-04-12" as IsoDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    });

    expect(result).toEqual({ success: true, didMutate: true });
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(insertTransaction).toHaveBeenCalledOnce();
    expect(enqueueSync).toHaveBeenCalledOnce();
  });

  it("keeps calendar bill save local-only", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const module = createWriteThroughMutationModule(mockDb);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    const result = await module.commit({
      kind: "calendar.bill.save",
      row: {
        id: "bill-1" as BillId,
        userId: "user-1" as UserId,
        name: "Rent",
        amount: 100000 as CopAmount,
        frequency: "monthly",
        categoryId: "housing" as CategoryId,
        startDate: "2026-04-01" as IsoDate,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(result).toEqual({ success: true, didMutate: true });
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(insertBill).toHaveBeenCalledOnce();
    expect(enqueueSync).not.toHaveBeenCalled();
  });

  it("writes both transaction and bill payment when marking bills paid", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const module = createWriteThroughMutationModule(mockDb);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    const result = await module.commit({
      kind: "calendar.bill.markPaid",
      transactionRow: {
        id: "tx-paid-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 250000 as CopAmount,
        categoryId: "housing" as CategoryId,
        description: "Rent",
        date: "2026-04-12" as IsoDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      paymentRow: {
        id: "payment-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-04-12" as IsoDate,
        paidAt: now,
        transactionId: "tx-paid-1" as TransactionId,
        createdAt: now,
      },
    });

    expect(result).toEqual({ success: true, didMutate: true });
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(insertTransaction).toHaveBeenCalledOnce();
    expect(insertBillPayment).toHaveBeenCalledOnce();
    expect(enqueueSync).toHaveBeenCalledOnce();
  });

  it("fails without side effects when the transaction wrapper throws", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const transaction = vi.fn(() => {
      throw new Error("db failure");
    });
    const failingDb = { transaction } as unknown as AnyDb;
    const module = createWriteThroughMutationModule(failingDb);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    const result = await module.commit({
      kind: "transaction.save",
      mode: "insert",
      row: {
        id: "tx-fail-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 1200 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        date: "2026-04-12" as IsoDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    });

    expect(result).toEqual({ success: false, error: "db failure" });
    expect(transaction).toHaveBeenCalledOnce();
    expect(insertTransaction).not.toHaveBeenCalled();
    expect(enqueueSync).not.toHaveBeenCalled();
  });
});
