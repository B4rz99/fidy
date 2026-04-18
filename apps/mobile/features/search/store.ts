import { create } from "zustand";
import type { StoredTransaction } from "@/features/transactions";
import { toStoredTransaction } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import { searchTransactionsAggregate, searchTransactionsPaginated } from "./lib/repository";
import type { SearchFilters, SearchSummary } from "./lib/types";
import { EMPTY_FILTERS } from "./lib/types";

const PAGE_SIZE = 30;

type SearchState = {
  filters: SearchFilters;
  results: StoredTransaction[];
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
    results: readonly StoredTransaction[],
    hasMore: boolean,
    summary: SearchSummary
  ) => void;
  appendSearchResults: (results: readonly StoredTransaction[], hasMore: boolean) => void;
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

export function executeSearch(db: AnyDb, userId: UserId): void {
  const { filters, setIsSearching, setSearchResults } = useSearchStore.getState();
  setIsSearching(true);

  try {
    const rows = searchTransactionsPaginated(db, userId, filters, PAGE_SIZE, 0);
    const hasMore = rows.length > PAGE_SIZE;
    const pageData = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(toStoredTransaction);
    const summary = searchTransactionsAggregate(db, userId, filters);
    setSearchResults(pageData, hasMore, summary);
  } catch {
    setIsSearching(false);
  }
}

export function loadNextSearchPage(db: AnyDb, userId: UserId): void {
  const { hasMore, offset, filters, appendSearchResults } = useSearchStore.getState();
  if (!hasMore) return;

  try {
    const rows = searchTransactionsPaginated(db, userId, filters, PAGE_SIZE, offset);
    const hasMoreResults = rows.length > PAGE_SIZE;
    const pageData = (hasMoreResults ? rows.slice(0, PAGE_SIZE) : rows).map(toStoredTransaction);
    appendSearchResults(pageData, hasMoreResults);
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
