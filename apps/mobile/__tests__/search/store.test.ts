import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as searchRepository from "@/features/search/lib/repository";
import { EMPTY_FILTERS } from "@/features/search/lib/types";
import type { SearchResult } from "@/features/search/lib/types";
import type { StoredTransaction } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import { requireUserId } from "@/shared/types/assertions";

type SearchRow = ReturnType<typeof makeRow>;
type SearchTransferRow = ReturnType<typeof makeTransferRow>;
type SearchSummary = { readonly count: number; readonly total: number };

const mockSearchTransactionsPaginated = vi.fn<(...args: unknown[]) => SearchRow[]>();
const mockSearchTransactionsAggregate = vi.fn<(...args: unknown[]) => SearchSummary>();
const mockSearchTransfersPaginated = vi.fn<(...args: unknown[]) => SearchTransferRow[]>();
const mockSearchTransfersAggregate = vi.fn<(...args: unknown[]) => SearchSummary>();
const mockGetSearchTransferAccountNames = vi.fn<(...args: unknown[]) => Record<string, string>>();
const mockToStoredTransaction = vi.fn<(row: SearchRow) => StoredTransaction & { converted: true }>(
  (row) =>
    ({
      ...row,
      date: new Date(row.date),
      updatedAt: new Date(row.updatedAt),
      converted: true,
    }) as unknown as StoredTransaction & { converted: true }
);
const toTransactionSearchResult = (row: SearchRow): SearchResult => {
  const transaction = mockToStoredTransaction(row);
  return {
    kind: "transaction",
    id: transaction.id,
    date: transaction.date,
    updatedAt: transaction.updatedAt,
    transaction,
  };
};

vi.spyOn(searchRepository, "searchTransactionsPaginated").mockImplementation(
  (...args) =>
    mockSearchTransactionsPaginated(...args) as ReturnType<
      typeof searchRepository.searchTransactionsPaginated
    >
);
vi.spyOn(searchRepository, "searchTransactionsAggregate").mockImplementation((...args) =>
  mockSearchTransactionsAggregate(...args)
);
vi.spyOn(searchRepository, "searchTransfersPaginated").mockImplementation(
  (...args) =>
    mockSearchTransfersPaginated(...args) as ReturnType<
      typeof searchRepository.searchTransfersPaginated
    >
);
vi.spyOn(searchRepository, "searchTransfersAggregate").mockImplementation((...args) =>
  mockSearchTransfersAggregate(...args)
);
vi.spyOn(searchRepository, "getSearchTransferAccountNames").mockImplementation((...args) =>
  mockGetSearchTransferAccountNames(...args)
);

vi.mock("@/features/transactions/query.public", () => ({
  toStoredTransaction: (row: SearchRow) => mockToStoredTransaction(row),
}));

const { executeSearch, loadNextSearchPage, updateSearchQuery, useSearchStore } =
  await import("@/features/search/store");

afterAll(() => {
  vi.restoreAllMocks();
});

const mockDb = {} as unknown as AnyDb;
const USER_ID = requireUserId("user-1");

const makeRow = (id: string) => ({
  id,
  description: `Row ${id}`,
  amount: 1000,
  type: "expense",
  categoryId: "food",
  date: "2026-03-10",
  updatedAt: "2026-03-10T12:00:00.000Z",
});

const makeTransferRow = (id: string) => ({
  id,
  userId: USER_ID,
  amount: 5000,
  fromAccountId: "account-1",
  fromExternalLabel: null,
  toAccountId: "account-2",
  toExternalLabel: null,
  description: `Transfer ${id}`,
  date: "2026-03-11",
  createdAt: "2026-03-11T09:00:00.000Z",
  updatedAt: "2026-03-11T09:30:00.000Z",
  voidedAt: null,
  source: "manual" as const,
});

describe("search store boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.getState().reset();
    mockSearchTransactionsAggregate.mockReturnValue({ count: 0, total: 0 });
    mockSearchTransactionsPaginated.mockReturnValue([]);
    mockSearchTransfersAggregate.mockReturnValue({ count: 0, total: 0 });
    mockSearchTransfersPaginated.mockReturnValue([]);
    mockGetSearchTransferAccountNames.mockReturnValue({
      "account-1": "Checking",
      "account-2": "Savings",
    });
  });

  it("executes the first page through the explicit boundary", () => {
    useSearchStore.setState({
      filters: { ...EMPTY_FILTERS, query: "coffee" },
    });
    mockSearchTransactionsPaginated.mockReturnValueOnce([makeRow("tx-1"), makeRow("tx-2")]);
    mockSearchTransactionsAggregate.mockReturnValueOnce({ count: 2, total: 2000 });

    executeSearch(mockDb, USER_ID);

    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      filters: expect.objectContaining({ query: "coffee" }),
      limit: 30,
      offset: 0,
    });
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
      filters: { ...EMPTY_FILTERS, type: "expense" },
      results: [toTransactionSearchResult(makeRow("tx-1"))],
      offset: 1,
      hasMore: true,
    });
    mockSearchTransactionsPaginated.mockReturnValueOnce([
      makeRow("tx-1"),
      makeRow("tx-2"),
      makeRow("tx-3"),
    ]);

    loadNextSearchPage(mockDb, USER_ID);

    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      filters: expect.objectContaining({ type: "expense" }),
      limit: 31,
      offset: 0,
    });
    expect(useSearchStore.getState().results).toEqual([
      toTransactionSearchResult(makeRow("tx-1")),
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
    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      filters: expect.objectContaining({ query: "rent" }),
      limit: 30,
      offset: 0,
    });
    expect(useSearchStore.getState().results).toEqual([
      expect.objectContaining({
        id: "tx-9",
        transaction: expect.objectContaining({ converted: true }),
      }),
    ]);
  });

  it("includes transfers in the default all-type search", () => {
    mockSearchTransactionsPaginated.mockReturnValueOnce([makeRow("tx-1")]);
    mockSearchTransfersPaginated.mockReturnValueOnce([makeTransferRow("transfer-1")]);
    mockSearchTransactionsAggregate.mockReturnValueOnce({ count: 1, total: 1000 });
    mockSearchTransfersAggregate.mockReturnValueOnce({ count: 1, total: 5000 });

    executeSearch(mockDb, USER_ID);

    expect(mockSearchTransactionsPaginated).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      filters: EMPTY_FILTERS,
      limit: 30,
      offset: 0,
    });
    expect(mockSearchTransfersPaginated).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      filters: EMPTY_FILTERS,
      limit: 30,
      offset: 0,
    });
    expect(useSearchStore.getState()).toMatchObject({
      results: [
        expect.objectContaining({ kind: "transfer", id: "transfer-1" }),
        expect.objectContaining({ kind: "transaction", id: "tx-1" }),
      ],
      summary: { count: 2, total: 6000 },
    });
  });

  it("executes transfer searches with account names for display", () => {
    useSearchStore.setState({
      filters: { ...EMPTY_FILTERS, type: "transfer" },
    });
    mockSearchTransfersPaginated.mockReturnValueOnce([makeTransferRow("transfer-1")]);
    mockSearchTransfersAggregate.mockReturnValueOnce({ count: 1, total: 5000 });

    executeSearch(mockDb, USER_ID);

    expect(mockSearchTransfersPaginated).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      filters: expect.objectContaining({ type: "transfer" }),
      limit: 30,
      offset: 0,
    });
    expect(mockSearchTransactionsPaginated).not.toHaveBeenCalled();
    expect(mockGetSearchTransferAccountNames).toHaveBeenCalledWith(mockDb, USER_ID);
    expect(useSearchStore.getState()).toMatchObject({
      results: [
        expect.objectContaining({
          kind: "transfer",
          id: "transfer-1",
          accountNames: { "account-1": "Checking", "account-2": "Savings" },
        }),
      ],
      summary: { count: 1, total: 5000 },
    });
  });
});
