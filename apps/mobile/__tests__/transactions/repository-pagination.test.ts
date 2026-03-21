// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IsoDate, Month, UserId } from "@/shared/types/branded";

const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn().mockReturnValue(undefined);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockOffset = vi.fn().mockReturnThis();
const mockGroupBy = vi.fn().mockReturnThis();

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
} as any;

describe("getTransactionsPaginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockReturnValue({ all: mockAll });
  });

  it("returns rows from the database", async () => {
    const mockRows = [
      {
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 1000,
        categoryId: "food",
        description: "Coffee",
        date: "2026-03-14",
        createdAt: "2026-03-14T10:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
        deletedAt: null,
        source: "manual",
      },
    ];
    mockAll.mockReturnValueOnce(mockRows);

    const { getTransactionsPaginated } = await import("@/features/transactions/lib/repository");
    const result = getTransactionsPaginated(mockDb, "user-1" as UserId, 30, 0);

    expect(result).toEqual(mockRows);
  });

  it("calls limit with limit+1 for hasMore detection", async () => {
    const { getTransactionsPaginated } = await import("@/features/transactions/lib/repository");
    getTransactionsPaginated(mockDb, "user-1" as UserId, 30, 0);

    expect(mockLimit).toHaveBeenCalledWith(31);
  });

  it("calls offset with the given offset value", async () => {
    const { getTransactionsPaginated } = await import("@/features/transactions/lib/repository");
    getTransactionsPaginated(mockDb, "user-1" as UserId, 30, 60);

    expect(mockOffset).toHaveBeenCalledWith(60);
  });

  it("queries the correct table with select and from", async () => {
    const { getTransactionsPaginated } = await import("@/features/transactions/lib/repository");
    getTransactionsPaginated(mockDb, "user-1" as UserId, 30, 0);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("returns empty array when no transactions exist", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getTransactionsPaginated } = await import("@/features/transactions/lib/repository");
    const result = getTransactionsPaginated(mockDb, "user-1" as UserId, 30, 0);

    expect(result).toEqual([]);
  });
});

describe("getBalanceAggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ get: mockGet });
  });

  it("returns the balance value from the database", async () => {
    mockGet.mockReturnValueOnce({ balance: 5000 });

    const { getBalanceAggregate } = await import("@/features/transactions/lib/repository");
    const result = getBalanceAggregate(mockDb, "user-1" as UserId);

    expect(result).toBe(5000);
  });

  it("returns 0 when no transactions exist", async () => {
    mockGet.mockReturnValueOnce({ balance: null });

    const { getBalanceAggregate } = await import("@/features/transactions/lib/repository");
    const result = getBalanceAggregate(mockDb, "user-1" as UserId);

    expect(result).toBe(0);
  });

  it("calls select, from, and where", async () => {
    mockGet.mockReturnValueOnce({ balance: 0 });

    const { getBalanceAggregate } = await import("@/features/transactions/lib/repository");
    getBalanceAggregate(mockDb, "user-1" as UserId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});

describe("getSpendingByCategoryAggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ groupBy: mockGroupBy });
    mockGroupBy.mockReturnValue({ all: mockAll });
  });

  it("returns spending grouped by category", async () => {
    const mockResult = [
      { categoryId: "food", total: 3500 },
      { categoryId: "transport", total: 1200 },
    ];
    mockAll.mockReturnValueOnce(mockResult);

    const { getSpendingByCategoryAggregate } = await import(
      "@/features/transactions/lib/repository"
    );
    const result = getSpendingByCategoryAggregate(mockDb, "user-1" as UserId, "2026-03" as Month);

    expect(result).toEqual(mockResult);
  });

  it("returns empty array when no expenses in month", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getSpendingByCategoryAggregate } = await import(
      "@/features/transactions/lib/repository"
    );
    const result = getSpendingByCategoryAggregate(mockDb, "user-1" as UserId, "2026-03" as Month);

    expect(result).toEqual([]);
  });

  it("calls groupBy for category aggregation", async () => {
    const { getSpendingByCategoryAggregate } = await import(
      "@/features/transactions/lib/repository"
    );
    getSpendingByCategoryAggregate(mockDb, "user-1" as UserId, "2026-03" as Month);

    expect(mockGroupBy).toHaveBeenCalled();
  });
});

describe("getDailySpendingAggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ groupBy: mockGroupBy });
    mockGroupBy.mockReturnValue({ all: mockAll });
  });

  it("returns spending grouped by date", async () => {
    const mockResult = [
      { date: "2026-03-13", total: 2500 },
      { date: "2026-03-14", total: 1800 },
    ];
    mockAll.mockReturnValueOnce(mockResult);

    const { getDailySpendingAggregate } = await import("@/features/transactions/lib/repository");
    const result = getDailySpendingAggregate(
      mockDb,
      "user-1" as UserId,
      "2026-02-12" as IsoDate,
      "2026-03-14" as IsoDate
    );

    expect(result).toEqual(mockResult);
  });

  it("returns empty array when no expenses in range", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getDailySpendingAggregate } = await import("@/features/transactions/lib/repository");
    const result = getDailySpendingAggregate(
      mockDb,
      "user-1" as UserId,
      "2026-02-12" as IsoDate,
      "2026-03-14" as IsoDate
    );

    expect(result).toEqual([]);
  });
});

describe("getRecentTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ all: mockAll });
  });

  it("returns transactions from current and previous month", async () => {
    const mockRows = [
      {
        id: "tx-1",
        userId: "user-1",
        type: "expense",
        amount: 1000,
        categoryId: "food",
        description: "Coffee",
        date: "2026-03-14",
        createdAt: "2026-03-14T10:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
        deletedAt: null,
        source: "manual",
      },
    ];
    mockAll.mockReturnValueOnce(mockRows);

    const { getRecentTransactions } = await import("@/features/transactions/lib/repository");
    const result = getRecentTransactions(
      mockDb,
      "user-1" as UserId,
      "2026-03" as Month,
      "2026-02" as Month
    );

    expect(result).toEqual(mockRows);
  });

  it("returns empty array when no transactions in range", async () => {
    mockAll.mockReturnValueOnce([]);

    const { getRecentTransactions } = await import("@/features/transactions/lib/repository");
    const result = getRecentTransactions(
      mockDb,
      "user-1" as UserId,
      "2026-03" as Month,
      "2026-02" as Month
    );

    expect(result).toEqual([]);
  });

  it("calls where and orderBy for filtering and sorting", async () => {
    const { getRecentTransactions } = await import("@/features/transactions/lib/repository");
    getRecentTransactions(mockDb, "user-1" as UserId, "2026-03" as Month, "2026-02" as Month);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
  });
});
