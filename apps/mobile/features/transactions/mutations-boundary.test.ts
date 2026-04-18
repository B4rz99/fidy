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

type SharedLibModule = typeof import("@/shared/lib");

const mocks = vi.hoisted(() => ({
  insertTransaction: vi.fn(),
  upsertTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  insertBill: vi.fn(),
  insertBillPayment: vi.fn(),
  deleteBillPayment: vi.fn(),
  deleteBill: vi.fn(),
  updateBill: vi.fn(),
  insertUserCategory: vi.fn(),
  insertGoal: vi.fn(),
  insertContribution: vi.fn(),
  softDeleteGoal: vi.fn(),
  softDeleteContribution: vi.fn(),
  updateGoal: vi.fn(),
  insertBudget: vi.fn(),
  updateBudgetAmount: vi.fn(),
  softDeleteBudget: vi.fn(),
  copyBudgetsToMonth: vi.fn(() => []),
  insertNotification: vi.fn(() => ({ changes: 1 })),
  getAllNotificationIds: vi.fn(() => []),
  softDeleteAllNotifications: vi.fn(),
  enqueueSync: vi.fn(),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: mocks.insertTransaction,
  upsertTransaction: mocks.upsertTransaction,
  softDeleteTransaction: mocks.softDeleteTransaction,
}));

vi.mock("@/features/calendar/lib/repository", () => ({
  insertBill: mocks.insertBill,
  insertBillPayment: mocks.insertBillPayment,
  deleteBillPayment: mocks.deleteBillPayment,
  deleteBill: mocks.deleteBill,
  updateBill: mocks.updateBill,
}));

vi.mock("@/features/categories/lib/repository", () => ({
  insertUserCategory: mocks.insertUserCategory,
}));

vi.mock("@/features/goals/lib/repository", () => ({
  insertGoal: mocks.insertGoal,
  insertContribution: mocks.insertContribution,
  softDeleteGoal: mocks.softDeleteGoal,
  softDeleteContribution: mocks.softDeleteContribution,
  updateGoal: mocks.updateGoal,
}));

vi.mock("@/features/budget/lib/repository", () => ({
  insertBudget: mocks.insertBudget,
  updateBudgetAmount: mocks.updateBudgetAmount,
  softDeleteBudget: mocks.softDeleteBudget,
  copyBudgetsToMonth: mocks.copyBudgetsToMonth,
}));

vi.mock("@/features/notifications/repository", () => ({
  insertNotification: mocks.insertNotification,
  getAllNotificationIds: mocks.getAllNotificationIds,
  softDeleteAllNotifications: mocks.softDeleteAllNotifications,
}));

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: mocks.enqueueSync,
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<SharedLibModule>("@/shared/lib");
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
    expect(mocks.insertTransaction).toHaveBeenCalledOnce();
    expect(mocks.enqueueSync).toHaveBeenCalledOnce();
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
    expect(mocks.insertBill).toHaveBeenCalledOnce();
    expect(mocks.enqueueSync).not.toHaveBeenCalled();
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
    expect(mocks.insertTransaction).toHaveBeenCalledOnce();
    expect(mocks.insertBillPayment).toHaveBeenCalledOnce();
    expect(mocks.enqueueSync).toHaveBeenCalledOnce();
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
    expect(mocks.insertTransaction).not.toHaveBeenCalled();
    expect(mocks.enqueueSync).not.toHaveBeenCalled();
  });
});
