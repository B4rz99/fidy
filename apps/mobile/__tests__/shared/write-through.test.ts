import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDb } from "@/shared/db";
import { getMutationPolicy } from "@/shared/mutations";
import type {
  BillId,
  BillPaymentId,
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  Month,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

vi.mock("@/shared/db/enqueue-sync", () => ({
  enqueueSync: vi.fn(),
}));

vi.mock("@/shared/lib", () => ({
  generateBudgetId: vi.fn().mockReturnValue("budget-generated"),
  generateSyncQueueId: vi.fn().mockReturnValue("sync-generated"),
}));

vi.mock("@/features/transactions/lib/repository", () => ({
  insertTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  upsertTransaction: vi.fn(),
}));

vi.mock("@/features/goals/lib/repository", () => ({
  insertGoal: vi.fn(),
  updateGoal: vi.fn(),
  softDeleteGoal: vi.fn(),
  insertContribution: vi.fn(),
  softDeleteContribution: vi.fn(),
}));

vi.mock("@/features/budget/lib/repository", () => ({
  insertBudget: vi.fn(),
  updateBudgetAmount: vi.fn(),
  softDeleteBudget: vi.fn(),
  copyBudgetsToMonth: vi.fn().mockReturnValue(["budget-copy-1"]),
}));

vi.mock("@/features/notifications/repository", () => ({
  insertNotification: vi.fn().mockReturnValue({ changes: 1 }),
  getAllNotificationIds: vi.fn().mockReturnValue(["nf-1", "nf-2"]),
  softDeleteAllNotifications: vi.fn(),
}));

vi.mock("@/features/categories/lib/repository", () => ({
  insertUserCategory: vi.fn(),
}));

vi.mock("@/features/calendar/lib/repository", () => ({
  insertBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBill: vi.fn(),
  insertBillPayment: vi.fn(),
  deleteBillPayment: vi.fn(),
}));

const mockDb = {
  transaction: vi.fn((fn: (tx: AnyDb) => unknown) => fn(mockDb as AnyDb)),
} as unknown as AnyDb;

async function loadModule() {
  return import("@/shared/mutations");
}

describe("write-through mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes the explicit sync policy", () => {
    expect(getMutationPolicy("calendar.bill.save")).toBe("local-only");
    expect(getMutationPolicy("transaction.save")).toBe("sync-backed");
  });

  it("writes sync-backed transaction saves through the boundary", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const { insertTransaction } = await import("@/features/transactions/lib/repository");
    const { enqueueSync } = await import("@/shared/db/enqueue-sync");
    const module = createWriteThroughMutationModule(mockDb);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    const result = await module.commit({
      kind: "transaction.save",
      mode: "insert",
      row: {
        id: "tx-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 1000 as CopAmount,
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
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        operation: "insert",
      })
    );
  });

  it("keeps calendar bill CRUD local-only", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const { insertBill } = await import("@/features/calendar/lib/repository");
    const { enqueueSync } = await import("@/shared/db/enqueue-sync");
    const module = createWriteThroughMutationModule(mockDb);

    const result = await module.commit({
      kind: "calendar.bill.save",
      row: {
        id: "bill-1" as BillId,
        userId: "user-1" as UserId,
        name: "Rent",
        amount: 100000 as CopAmount,
        frequency: "monthly",
        categoryId: "home" as CategoryId,
        startDate: "2026-04-01" as IsoDate,
        isActive: true,
        createdAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
      },
    });

    expect(result).toEqual({ success: true, didMutate: true });
    expect(insertBill).toHaveBeenCalledOnce();
    expect(enqueueSync).not.toHaveBeenCalled();
  });

  it("marks bill payments paid in one write-through commit", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const { insertTransaction } = await import("@/features/transactions/lib/repository");
    const { insertBillPayment } = await import("@/features/calendar/lib/repository");
    const { enqueueSync } = await import("@/shared/db/enqueue-sync");
    const module = createWriteThroughMutationModule(mockDb);
    const now = "2026-04-12T10:00:00.000Z" as IsoDateTime;

    await module.commit({
      kind: "calendar.bill.markPaid",
      transactionRow: {
        id: "tx-pay-1" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 45000 as CopAmount,
        categoryId: "services" as CategoryId,
        description: "Internet",
        date: "2026-04-12" as IsoDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      paymentRow: {
        id: "bp-1" as BillPaymentId,
        billId: "bill-1" as BillId,
        dueDate: "2026-04-12" as IsoDate,
        paidAt: now,
        transactionId: "tx-pay-1" as TransactionId,
        createdAt: now,
      },
    });

    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(insertTransaction).toHaveBeenCalledOnce();
    expect(insertBillPayment).toHaveBeenCalledOnce();
    expect(enqueueSync).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        tableName: "transactions",
        operation: "insert",
      })
    );
  });

  it("commits budget batches atomically", async () => {
    const { createWriteThroughMutationModule } = await loadModule();
    const { insertBudget } = await import("@/features/budget/lib/repository");
    const { enqueueSync } = await import("@/shared/db/enqueue-sync");
    const module = createWriteThroughMutationModule(mockDb);

    const result = await module.commitBatch([
      {
        kind: "budget.save",
        row: {
          id: "budget-1" as BudgetId,
          userId: "user-1" as UserId,
          categoryId: "food" as CategoryId,
          amount: 10000 as CopAmount,
          month: "2026-04" as Month,
          createdAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
          updatedAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
          deletedAt: null,
        },
      },
      {
        kind: "budget.save",
        row: {
          id: "budget-2" as BudgetId,
          userId: "user-1" as UserId,
          categoryId: "transport" as CategoryId,
          amount: 20000 as CopAmount,
          month: "2026-04" as Month,
          createdAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
          updatedAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
          deletedAt: null,
        },
      },
    ]);

    expect(result).toEqual([
      { success: true, didMutate: true },
      { success: true, didMutate: true },
    ]);
    expect(insertBudget).toHaveBeenCalledTimes(2);
    expect(enqueueSync).toHaveBeenCalledTimes(2);
  });
});
