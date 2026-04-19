import { describe, expect, it, vi } from "vitest";
import { createTransactionQueryService } from "@/features/transactions/services/create-transaction-query-service";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mockUserId = "user-1" as UserId;

function makeRow(
  overrides: Partial<{
    id: TransactionId;
    userId: UserId;
    amount: CopAmount;
    categoryId: CategoryId;
    description: string | null;
    date: IsoDate;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
    deletedAt: IsoDateTime | null;
  }> = {}
) {
  return {
    id: "tx-1" as TransactionId,
    userId: mockUserId,
    type: "expense",
    amount: 1200 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: "2026-04-12" as IsoDate,
    createdAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    accountId: "fa-default-user-1" as FinancialAccountId,
    accountAttributionState: "confirmed",
    source: "manual",
    ...overrides,
  };
}

describe("transaction query service", () => {
  it("loads an initial snapshot with page and aggregate data", () => {
    const getTransactionsPaginated = vi.fn().mockReturnValue([makeRow()]);
    const getSpendingByCategoryAggregate = vi
      .fn()
      .mockReturnValue([{ categoryId: "food" as CategoryId, total: 1200 as CopAmount }]);
    const getDailySpendingAggregate = vi
      .fn()
      .mockReturnValue([{ date: "2026-04-12" as IsoDate, total: 1200 as CopAmount }]);
    const service = createTransactionQueryService({
      getTransactionsPaginated,
      getSpendingByCategoryAggregate,
      getDailySpendingAggregate,
      getNow: () => new Date("2026-04-12T18:00:00.000Z"),
    });

    const snapshot = service.loadInitialSnapshot({
      db: {} as never,
      userId: mockUserId,
      pageSize: 30,
    });

    expect(snapshot).toMatchObject({
      offset: 1,
      hasMore: false,
      balance: 1200,
      categorySpending: [{ categoryId: "food", total: 1200 }],
      dailySpending: [{ date: "2026-04-12", total: 1200 }],
    });
    expect(snapshot.pages[0]).toMatchObject({
      id: "tx-1",
      description: "Lunch",
    });
    expect(snapshot.pages[0]?.date).toBeInstanceOf(Date);
  });

  it("marks refresh snapshots as unchanged when ids and updatedAt values match", () => {
    const getTransactionsPaginated = vi.fn().mockReturnValue([
      makeRow({
        id: "tx-1" as TransactionId,
        updatedAt: "2026-04-12T10:00:00.000Z" as IsoDateTime,
      }),
    ]);
    const service = createTransactionQueryService({
      getTransactionsPaginated,
      getSpendingByCategoryAggregate: vi.fn().mockReturnValue([]),
      getDailySpendingAggregate: vi.fn().mockReturnValue([]),
      getNow: () => new Date("2026-04-12T18:00:00.000Z"),
    });

    const currentPages = [
      {
        id: "tx-1" as TransactionId,
        userId: mockUserId,
        type: "expense" as const,
        amount: 1200 as CopAmount,
        categoryId: "food" as CategoryId,
        description: "Lunch",
        date: new Date("2026-04-12T00:00:00.000Z"),
        createdAt: new Date("2026-04-12T10:00:00.000Z"),
        updatedAt: new Date("2026-04-12T10:00:00.000Z"),
        deletedAt: null,
        accountId: "fa-default-user-1" as FinancialAccountId,
        accountAttributionState: "confirmed" as const,
      },
    ];

    const snapshot = service.loadRefreshSnapshot({
      db: {} as never,
      userId: mockUserId,
      currentPages,
      currentOffset: 1,
      pageSize: 30,
    });

    expect(snapshot.sameData).toBe(true);
    expect(snapshot.offset).toBe(1);
    expect(snapshot.hasMore).toBe(false);
    expect(getTransactionsPaginated).toHaveBeenCalledWith(expect.anything(), mockUserId, 30, 0);
  });

  it("uses an inclusive 30-day daily-spending window", () => {
    const getDailySpendingAggregate = vi.fn().mockReturnValue([]);
    const service = createTransactionQueryService({
      getTransactionsPaginated: vi.fn().mockReturnValue([]),
      getSpendingByCategoryAggregate: vi.fn().mockReturnValue([]),
      getDailySpendingAggregate,
      getNow: () => new Date("2026-04-12T18:00:00.000Z"),
    });

    service.loadAggregateSnapshot({
      db: {} as never,
      userId: mockUserId,
    });

    expect(getDailySpendingAggregate).toHaveBeenCalledWith(
      expect.anything(),
      mockUserId,
      "2026-03-14",
      "2026-04-12"
    );
  });

  it("returns null for deleted or cross-user transaction lookups", () => {
    const getTransactionById = vi
      .fn()
      .mockReturnValueOnce(makeRow({ userId: "user-2" as UserId }))
      .mockReturnValueOnce(makeRow({ deletedAt: "2026-04-13T08:00:00.000Z" as IsoDateTime }));
    const service = createTransactionQueryService({ getTransactionById });

    expect(
      service.getStoredTransaction({
        db: {} as never,
        userId: mockUserId,
        transactionId: "tx-1" as TransactionId,
      })
    ).toBeNull();

    expect(
      service.getStoredTransaction({
        db: {} as never,
        userId: mockUserId,
        transactionId: "tx-1" as TransactionId,
      })
    ).toBeNull();
  });
});
