import { describe, expect, it, vi } from "vitest";
import { createActivityQueryService } from "@/features/activity/services/create-activity-query-service";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;

function makeTransactionRow(
  overrides: Partial<{
    id: TransactionId;
    amount: CopAmount;
    categoryId: CategoryId;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
  }> = {}
) {
  return {
    id: "tx-1" as TransactionId,
    userId: USER_ID,
    type: "expense",
    amount: 120_000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: "2026-04-18" as IsoDate,
    accountId: "fa-checking" as FinancialAccountId,
    accountAttributionState: "confirmed",
    createdAt: "2026-04-18T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-04-18T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    source: "manual",
    ...overrides,
  };
}

function makeTransferRow(
  overrides: Partial<{
    id: TransferId;
    amount: CopAmount;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
  }> = {}
) {
  return {
    id: "tr-1" as TransferId,
    userId: USER_ID,
    amount: 450_000 as CopAmount,
    fromAccountId: "fa-checking" as FinancialAccountId,
    toAccountId: "fa-card" as FinancialAccountId,
    fromExternalLabel: null,
    toExternalLabel: null,
    description: null,
    date: "2026-04-19" as IsoDate,
    createdAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    ...overrides,
  };
}

describe("activity query service", () => {
  it("merges transactions and transfers into one newest-first activity page", () => {
    const getTransactionsPaginated = vi.fn().mockReturnValue([
      makeTransactionRow({
        id: "tx-newer" as TransactionId,
        date: "2026-04-19" as IsoDate,
        updatedAt: "2026-04-19T08:00:00.000Z" as IsoDateTime,
      }),
      makeTransactionRow({
        id: "tx-older" as TransactionId,
        date: "2026-04-17" as IsoDate,
        updatedAt: "2026-04-17T08:00:00.000Z" as IsoDateTime,
      }),
    ]);
    const getTransfersPaginated = vi.fn().mockReturnValue([
      makeTransferRow({
        id: "tr-newest" as TransferId,
        date: "2026-04-19" as IsoDate,
        updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
      }),
    ]);
    const service = createActivityQueryService({
      getTransactionsPaginated,
      getTransfersPaginated,
    });

    const snapshot = service.loadPage({
      db: {} as never,
      userId: USER_ID,
      pageSize: 30,
      offset: 0,
    });

    expect(snapshot.hasMore).toBe(false);
    expect(snapshot.offset).toBe(3);
    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transfer:tr-newest",
      "transaction:tx-newer",
      "transaction:tx-older",
    ]);
  });

  it("paginates after merging instead of paging the sources independently", () => {
    const getTransactionsPaginated = vi.fn().mockReturnValue([
      makeTransactionRow({
        id: "tx-1" as TransactionId,
        date: "2026-04-19" as IsoDate,
        updatedAt: "2026-04-19T08:00:00.000Z" as IsoDateTime,
      }),
      makeTransactionRow({
        id: "tx-2" as TransactionId,
        date: "2026-04-18" as IsoDate,
        updatedAt: "2026-04-18T08:00:00.000Z" as IsoDateTime,
      }),
      makeTransactionRow({
        id: "tx-3" as TransactionId,
        date: "2026-04-17" as IsoDate,
        updatedAt: "2026-04-17T08:00:00.000Z" as IsoDateTime,
      }),
    ]);
    const getTransfersPaginated = vi.fn().mockReturnValue([
      makeTransferRow({
        id: "tr-1" as TransferId,
        date: "2026-04-19" as IsoDate,
        updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
      }),
      makeTransferRow({
        id: "tr-2" as TransferId,
        date: "2026-04-18" as IsoDate,
        updatedAt: "2026-04-18T09:00:00.000Z" as IsoDateTime,
      }),
      makeTransferRow({
        id: "tr-3" as TransferId,
        date: "2026-04-16" as IsoDate,
        updatedAt: "2026-04-16T09:00:00.000Z" as IsoDateTime,
      }),
    ]);
    const service = createActivityQueryService({
      getTransactionsPaginated,
      getTransfersPaginated,
    });

    const snapshot = service.loadPage({
      db: {} as never,
      userId: USER_ID,
      pageSize: 2,
      offset: 2,
    });

    expect(snapshot.hasMore).toBe(true);
    expect(snapshot.offset).toBe(4);
    expect(snapshot.pages.map((item) => `${item.kind}:${item.id}`)).toEqual([
      "transfer:tr-2",
      "transaction:tx-2",
    ]);
    expect(getTransactionsPaginated).toHaveBeenCalledWith(expect.anything(), USER_ID, 5, 0);
    expect(getTransfersPaginated).toHaveBeenCalledWith(expect.anything(), USER_ID, 5, 0);
  });
});
