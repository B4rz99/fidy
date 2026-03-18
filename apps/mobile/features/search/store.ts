import { create } from "zustand";
import type { StoredTransaction } from "@/features/transactions";
import { toStoredTransaction } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { searchTransactionsAggregate, searchTransactionsPaginated } from "./lib/repository";
import type { SearchFilters, SearchSummary } from "./lib/types";
import { EMPTY_FILTERS } from "./lib/types";

const PAGE_SIZE = 30;

let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

type SearchState = {
  filters: SearchFilters;
  results: StoredTransaction[];
  offset: number;
  hasMore: boolean;
  summary: SearchSummary | null;
  isSearching: boolean;
};

type SearchActions = {
  initStore: (db: AnyDb, userId: string) => void;
  setQuery: (query: string) => void;
  setFilters: (partial: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  executeSearch: () => void;
  loadNextPage: () => void;
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

export const useSearchStore = create<SearchState & SearchActions>((set, get) => ({
  ...INITIAL_STATE,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
  },

  setQuery: (query) => {
    set((s) => ({ filters: { ...s.filters, query } }));
    get().executeSearch();
  },

  setFilters: (partial) => {
    set((s) => ({ filters: { ...s.filters, ...partial } }));
    get().executeSearch();
  },

  clearFilters: () => {
    set({ filters: EMPTY_FILTERS });
    get().executeSearch();
  },

  executeSearch: () => {
    if (!dbRef || !userIdRef) return;
    set({ isSearching: true });
    try {
      const { filters } = get();
      const rows = searchTransactionsPaginated(dbRef, userIdRef, filters, PAGE_SIZE, 0);
      const hasMore = rows.length > PAGE_SIZE;
      const pageData = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      const summary = searchTransactionsAggregate(dbRef, userIdRef, filters);
      set({
        results: pageData.map(toStoredTransaction),
        offset: pageData.length,
        hasMore,
        summary,
        isSearching: false,
      });
    } catch {
      set({ isSearching: false });
    }
  },

  loadNextPage: () => {
    if (!dbRef || !userIdRef) return;
    const { hasMore, offset, filters } = get();
    if (!hasMore) return;
    try {
      const rows = searchTransactionsPaginated(dbRef, userIdRef, filters, PAGE_SIZE, offset);
      const moreAvailable = rows.length > PAGE_SIZE;
      const pageData = moreAvailable ? rows.slice(0, PAGE_SIZE) : rows;
      set((s) => ({
        results: [...s.results, ...pageData.map(toStoredTransaction)],
        offset: s.offset + pageData.length,
        hasMore: moreAvailable,
      }));
    } catch {
      // Keep existing state
    }
  },

  reset: () => {
    set(INITIAL_STATE);
  },
}));
