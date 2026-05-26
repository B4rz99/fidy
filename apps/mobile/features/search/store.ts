import { create } from "zustand";
import { toStoredTransaction } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import type { UserId } from "@/shared/types/branded";
import {
  getSearchTransferAccountNames,
  searchTransactionsAggregate,
  searchTransactionsPaginated,
  searchTransfersAggregate,
  searchTransfersPaginated,
} from "./lib/repository";
import type { SearchFilters, SearchResult, SearchSummary, SearchTransferSide } from "./lib/types";
import { EMPTY_FILTERS } from "./lib/types";

const PAGE_SIZE = 30;

type SearchState = {
  filters: SearchFilters;
  results: SearchResult[];
  offset: number;
  hasMore: boolean;
  summary: SearchSummary | null;
  isSearching: boolean;
};

type SearchActions = {
  setQuery: (query: string) => void;
  setFilters: (partial: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  setSearchResults: (
    results: readonly SearchResult[],
    hasMore: boolean,
    summary: SearchSummary
  ) => void;
  appendSearchResults: (results: readonly SearchResult[], hasMore: boolean) => void;
  setIsSearching: (isSearching: boolean) => void;
  reset: () => void;
};

const INITIAL_STATE: SearchState = {
  filters: EMPTY_FILTERS,
  results: [],
  offset: 0,
  hasMore: false,
  summary: null,
  isSearching: false,
};

export const useSearchStore = create<SearchState & SearchActions>((set) => ({
  ...INITIAL_STATE,

  setQuery: (query) => {
    set((state) => ({ filters: { ...state.filters, query } }));
  },

  setFilters: (partial) => {
    set((state) => ({ filters: { ...state.filters, ...partial } }));
  },

  clearFilters: () => {
    set({ filters: EMPTY_FILTERS });
  },

  setSearchResults: (results, hasMore, summary) =>
    set({
      results: [...results],
      offset: results.length,
      hasMore,
      summary,
      isSearching: false,
    }),

  appendSearchResults: (results, hasMore) =>
    set((state) => ({
      results: [...state.results, ...results],
      offset: state.offset + results.length,
      hasMore,
    })),

  setIsSearching: (isSearching) => set({ isSearching }),

  reset: () => {
    set(INITIAL_STATE);
  },
}));

function toTransactionSearchResult(row: ReturnType<typeof searchTransactionsPaginated>[number]) {
  const transaction = toStoredTransaction(row);
  return {
    kind: "transaction",
    id: transaction.id,
    date: transaction.date,
    updatedAt: transaction.updatedAt,
    transaction,
  } satisfies SearchResult;
}

function toTransferSearchResult(
  row: ReturnType<typeof searchTransfersPaginated>[number],
  accountNames: Readonly<Record<string, string>>
) {
  const toSide = (
    accountId: typeof row.fromAccountId,
    externalLabel: typeof row.fromExternalLabel
  ): SearchTransferSide =>
    accountId ? { kind: "account", accountId } : { kind: "external", label: externalLabel ?? "" };
  const transfer = {
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    fromSide: toSide(row.fromAccountId, row.fromExternalLabel),
    toSide: toSide(row.toAccountId, row.toExternalLabel),
    description: row.description ?? "",
    date: new Date(row.date),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.voidedAt ? new Date(row.voidedAt) : null,
    source: row.source,
  };
  return {
    kind: "transfer",
    id: transfer.id,
    date: transfer.date,
    updatedAt: transfer.updatedAt,
    transfer,
    accountNames,
  } satisfies SearchResult;
}

function compareSearchResultsByDateDesc(left: SearchResult, right: SearchResult) {
  const dateDiff = right.date.getTime() - left.date.getTime();
  if (dateDiff !== 0) return dateDiff;
  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function toSearchSummary(total: SearchSummary, next: SearchSummary): SearchSummary {
  return {
    count: total.count + next.count,
    total: total.total + next.total,
  };
}

function shouldIncludeTransfers(filters: SearchFilters) {
  return filters.type === "all" || filters.type === "transfer";
}

function shouldIncludeTransactions(filters: SearchFilters) {
  return filters.type === "all" || filters.type === "expense" || filters.type === "income";
}

export function executeSearch(db: AnyDb, userId: UserId): void {
  const { filters, setIsSearching, setSearchResults } = useSearchStore.getState();
  setIsSearching(true);

  try {
    const transactionRows = shouldIncludeTransactions(filters)
      ? searchTransactionsPaginated({
          db,
          userId,
          filters,
          limit: PAGE_SIZE,
          offset: 0,
        })
      : [];
    const transferRows = shouldIncludeTransfers(filters)
      ? searchTransfersPaginated({
          db,
          userId,
          filters,
          limit: PAGE_SIZE,
          offset: 0,
        })
      : [];
    const accountNames =
      transferRows.length > 0 ? getSearchTransferAccountNames(db, userId) : Object.create(null);
    const results = [
      ...transactionRows.map(toTransactionSearchResult),
      ...transferRows.map((row) => toTransferSearchResult(row, accountNames)),
    ].sort(compareSearchResultsByDateDesc);
    const pageRows = results.slice(0, PAGE_SIZE);
    const summary = [
      shouldIncludeTransactions(filters)
        ? searchTransactionsAggregate(db, userId, filters)
        : { count: 0, total: 0 },
      shouldIncludeTransfers(filters)
        ? searchTransfersAggregate(db, userId, filters)
        : { count: 0, total: 0 },
    ].reduce(toSearchSummary, { count: 0, total: 0 });
    setSearchResults(pageRows, results.length > PAGE_SIZE, summary);
  } catch {
    setIsSearching(false);
  }
}

export function loadNextSearchPage(db: AnyDb, userId: UserId): void {
  const { hasMore, offset, filters, appendSearchResults } = useSearchStore.getState();
  if (!hasMore) return;

  try {
    const queryLimit = PAGE_SIZE + offset;
    const transactionRows = shouldIncludeTransactions(filters)
      ? searchTransactionsPaginated({
          db,
          userId,
          filters,
          limit: queryLimit,
          offset: 0,
        })
      : [];
    const transferRows = shouldIncludeTransfers(filters)
      ? searchTransfersPaginated({
          db,
          userId,
          filters,
          limit: queryLimit,
          offset: 0,
        })
      : [];
    const accountNames =
      transferRows.length > 0 ? getSearchTransferAccountNames(db, userId) : Object.create(null);
    const results = [
      ...transactionRows.map(toTransactionSearchResult),
      ...transferRows.map((row) => toTransferSearchResult(row, accountNames)),
    ].sort(compareSearchResultsByDateDesc);
    const pageRows = results.slice(offset, offset + PAGE_SIZE);
    appendSearchResults(pageRows, results.length > offset + PAGE_SIZE);
  } catch {
    // Keep existing state
  }
}

export function updateSearchQuery(db: AnyDb, userId: UserId, query: string): void {
  useSearchStore.getState().setQuery(query);
  executeSearch(db, userId);
}

export function updateSearchFilters(
  db: AnyDb,
  userId: UserId,
  partial: Partial<SearchFilters>
): void {
  useSearchStore.getState().setFilters(partial);
  executeSearch(db, userId);
}

export function clearSearchFilters(db: AnyDb, userId: UserId): void {
  useSearchStore.getState().clearFilters();
  executeSearch(db, userId);
}
