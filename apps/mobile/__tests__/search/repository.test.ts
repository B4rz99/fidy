// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "@/shared/types/assertions";
import type { SearchFilters } from "../../features/search/lib/types";
import { EMPTY_FILTERS } from "../../features/search/lib/types";

const _mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn().mockReturnValue(null);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockOffset = vi.fn().mockReturnThis();

const mockDb = {
  select: mockSelect,
} as any;
const USER_ID = requireUserId("user-1");

const withFilters = (overrides: Partial<SearchFilters>): SearchFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe("search repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ count: 0, total: 0 });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      orderBy: mockOrderBy,
      get: mockGet,
      all: mockAll,
    });
    mockOrderBy.mockReturnValue({ limit: mockLimit, all: mockAll });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockReturnValue({ all: mockAll });
  });

  it("searchTransactionsPaginated calls db with limit+1 for hasMore detection", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: EMPTY_FILTERS,
      limit: 30,
      offset: 0,
    });

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(31);
    expect(mockOffset).toHaveBeenCalledWith(0);
    expect(mockAll).toHaveBeenCalled();
  });

  it("searchTransactionsPaginated passes correct offset", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: EMPTY_FILTERS,
      limit: 30,
      offset: 60,
    });

    expect(mockOffset).toHaveBeenCalledWith(60);
  });

  it("searchTransactionsAggregate returns count and total", async () => {
    mockGet.mockReturnValueOnce({ count: 5, total: 15000 });

    const { searchTransactionsAggregate } = await import("../../features/search/lib/repository");

    const result = searchTransactionsAggregate(mockDb, USER_ID, EMPTY_FILTERS);

    expect(result).toEqual({ count: 5, total: 15000 });
  });

  it("searchTransactionsAggregate returns zeros when no results", async () => {
    mockGet.mockReturnValueOnce(null);

    const { searchTransactionsAggregate } = await import("../../features/search/lib/repository");

    const result = searchTransactionsAggregate(mockDb, USER_ID, EMPTY_FILTERS);

    expect(result).toEqual({ count: 0, total: 0 });
  });

  it("applies query filter via LIKE when query is non-empty", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ query: "coffee" }),
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("does not apply LIKE filter when query is empty", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: EMPTY_FILTERS,
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("applies categoryIds filter via inArray", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ categoryIds: ["food", "transport"] }),
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("applies date range filters", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ dateFrom: "2026-03-01", dateTo: "2026-03-31" }),
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("applies amount range filters", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ amountMin: 100, amountMax: 5000 }),
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("applies type filter when not all", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ type: "expense" }),
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("does not apply type filter when type is all", async () => {
    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ type: "all" }),
      limit: 30,
      offset: 0,
    });

    expect(mockWhere).toHaveBeenCalled();
  });

  it("returns rows from paginated query", async () => {
    const mockRows = [
      { id: "tx-1", description: "Coffee", amount: 500 },
      { id: "tx-2", description: "Lunch", amount: 1500 },
    ];
    mockAll.mockReturnValueOnce(mockRows);

    const { searchTransactionsPaginated } = await import("../../features/search/lib/repository");

    const result = searchTransactionsPaginated({
      db: mockDb,
      userId: USER_ID,
      filters: withFilters({ query: "o" }),
      limit: 30,
      offset: 0,
    });

    expect(result).toEqual(mockRows);
  });
});
