// biome-ignore-all lint/suspicious/noExplicitAny: search store tests use flexible mock rows
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "@/features/search";
import {
  executeSearch,
  loadNextSearchPage,
  updateSearchQuery,
  useSearchStore,
} from "@/features/search/store";
import { requireUserId } from "@/shared/types/assertions";

const mockSearchTransactionsPaginated = vi.fn();
const mockSearchTransactionsAggregate = vi.fn();
const mockToStoredTransaction = vi.fn((row: any) => ({
  ...row,
  converted: true,
}));

vi.mock("@/features/search/lib/repository", () => ({
  searchTransactionsPaginated: (...args: any[]) => mockSearchTransactionsPaginated(...args),
  searchTransactionsAggregate: (...args: any[]) => mockSearchTransactionsAggregate(...args),
}));

vi.mock("@/features/transactions", () => ({
  toStoredTransaction: (row: any) => mockToStoredTransaction(row),
}));

const mockDb = {} as any;
const USER_ID = requireUserId("user-1");

const makeRow = (id: string) => ({
  id,
  description: `Row ${id}`,
  amount: 1000,
  type: "expense",
  categoryId: "food",
  date: "2026-03-10",
});

describe("search store boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.getState().reset();
    mockSearchTransactionsAggregate.mockReturnValue({ count: 0, total: 0 });
    mockSearchTransactionsPaginated.mockReturnValue([]);
  });

  it("executes the first page through the explicit boundary", () => {
    useSearchStore.setState({
      filters: { ...EMPTY_FILTERS, query: "coffee" },
    });
    mockSearchTransactionsPaginated.mockReturnValueOnce([makeRow("tx-1"), makeRow("tx-2")]);
    mockSearchTransactionsAggregate.mockReturnValueOnce({ count: 2, total: 2000 });

    executeSearch(mockDb, USER_ID);

    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      expect.objectContaining({ query: "coffee" }),
      30,
      0
    );
    expect(mockSearchTransactionsAggregate).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      expect.objectContaining({ query: "coffee" })
    );
    expect(useSearchStore.getState()).toMatchObject({
      results: [expect.objectContaining({ id: "tx-1" }), expect.objectContaining({ id: "tx-2" })],
      offset: 2,
      hasMore: false,
      summary: { count: 2, total: 2000 },
      isSearching: false,
    });
  });

  it("loads the next page through the explicit boundary", () => {
    useSearchStore.setState({
      results: [makeRow("tx-1")] as any,
      offset: 1,
      hasMore: true,
    });
    mockSearchTransactionsPaginated.mockReturnValueOnce([makeRow("tx-2"), makeRow("tx-3")]);

    loadNextSearchPage(mockDb, USER_ID);

    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      EMPTY_FILTERS,
      30,
      1
    );
    expect(useSearchStore.getState().results).toEqual([
      makeRow("tx-1"),
      expect.objectContaining({ id: "tx-2" }),
      expect.objectContaining({ id: "tx-3" }),
    ]);
    expect(useSearchStore.getState().offset).toBe(3);
    expect(useSearchStore.getState().hasMore).toBe(false);
  });

  it("updates the query through the explicit boundary and reruns search", () => {
    mockSearchTransactionsPaginated.mockReturnValueOnce([makeRow("tx-9")]);
    mockSearchTransactionsAggregate.mockReturnValueOnce({ count: 1, total: 1000 });

    updateSearchQuery(mockDb, USER_ID, "rent");

    expect(useSearchStore.getState().filters.query).toBe("rent");
    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      expect.objectContaining({ query: "rent" }),
      30,
      0
    );
    expect(useSearchStore.getState().results).toEqual([
      expect.objectContaining({ id: "tx-9", converted: true }),
    ]);
  });
});
