import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import { toIsoDate } from "@/shared/lib/format-date";
import { generateId } from "@/shared/lib/generate-id";
import { buildTransaction, toStoredTransaction, toTransactionRow } from "./lib/build-transaction";
import type { CategoryId } from "./lib/categories";
import {
  enqueueSync,
  getBalanceAggregate,
  getDailySpendingAggregate,
  getRecentTransactions,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
  insertTransaction,
  softDeleteTransaction,
} from "./lib/repository";
import type { StoredTransaction, TransactionType } from "./schema";

type FormStep = 1 | 2;

const PAGE_SIZE = 30;

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

type CategorySpendingItem = {
  readonly categoryId: string;
  readonly totalCents: number;
};

type DailySpendingItem = {
  readonly date: string;
  readonly totalCents: number;
};

type TransactionState = {
  // Form fields
  step: FormStep;
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
  description: string;
  date: Date;

  // Paginated transactions
  pages: StoredTransaction[];
  offset: number;
  hasMore: boolean;

  // Aggregate data (from SQL)
  balanceCents: number;
  categorySpending: CategorySpendingItem[];
  dailySpending: DailySpendingItem[];
};

type TransactionActions = {
  initStore: (db: AnyDb, userId: string) => void;
  setStep: (step: FormStep) => void;
  setType: (type: TransactionType) => void;
  setDigits: (digits: string) => void;
  setCategoryId: (id: CategoryId) => void;
  setDescription: (desc: string) => void;
  setDate: (date: Date) => void;
  saveTransaction: () => Promise<
    { success: true; transaction: StoredTransaction } | { success: false; error: string }
  >;
  loadInitialPage: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  loadAggregates: () => void;
  refresh: () => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addToCache: (tx: StoredTransaction) => void;
  removeFromCache: (id: string) => void;
  resetForm: () => void;
  getChatData: (currentMonth: string) => {
    recentTransactions: StoredTransaction[];
    balanceCents: number;
    categorySpending: CategorySpendingItem[];
    previousMonthSpending: CategorySpendingItem[];
  };
  getTransactionById: (id: string) => StoredTransaction | null;
};

function previousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

const INITIAL_FORM: Pick<
  TransactionState,
  "step" | "type" | "digits" | "categoryId" | "description"
> = {
  step: 1,
  type: "expense",
  digits: "",
  categoryId: null,
  description: "",
};

export const useTransactionStore = create<TransactionState & TransactionActions>((set, get) => ({
  ...INITIAL_FORM,
  date: new Date(),
  pages: [],
  offset: 0,
  hasMore: true,
  balanceCents: 0,
  categorySpending: [],
  dailySpending: [],

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
  },

  setStep: (step) => set({ step }),
  setType: (type) => set({ type }),
  setDigits: (digits) => set({ digits }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setDescription: (description) => set({ description }),
  setDate: (date) => set({ date }),

  loadInitialPage: async () => {
    if (!dbRef || !userIdRef) return;
    try {
      const rows = getTransactionsPaginated(dbRef, userIdRef, PAGE_SIZE, 0);
      const hasMore = rows.length > PAGE_SIZE;
      const pageData = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      set({
        pages: pageData.map(toStoredTransaction),
        offset: pageData.length,
        hasMore,
      });
      get().loadAggregates();
    } catch {
      // DB read failed — keep existing state
    }
  },

  loadNextPage: async () => {
    if (!dbRef || !userIdRef) return;
    const { hasMore, offset } = get();
    if (!hasMore) return;

    try {
      const rows = getTransactionsPaginated(dbRef, userIdRef, PAGE_SIZE, offset);
      const moreAvailable = rows.length > PAGE_SIZE;
      const pageData = moreAvailable ? rows.slice(0, PAGE_SIZE) : rows;
      set((s) => ({
        pages: [...s.pages, ...pageData.map(toStoredTransaction)],
        offset: s.offset + pageData.length,
        hasMore: moreAvailable,
      }));
    } catch {
      // DB read failed — keep existing state
    }
  },

  loadAggregates: () => {
    if (!dbRef || !userIdRef) return;
    try {
      const now = new Date();
      const currentMonth = toIsoDate(now).slice(0, 7);
      const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      const startDate = toIsoDate(thirtyDaysAgo);
      const endDate = toIsoDate(now);

      const balanceCents = getBalanceAggregate(dbRef, userIdRef);
      const categorySpending = getSpendingByCategoryAggregate(dbRef, userIdRef, currentMonth);
      const dailySpending = getDailySpendingAggregate(dbRef, userIdRef, startDate, endDate);

      set({ balanceCents, categorySpending, dailySpending });
    } catch {
      // Aggregate query failed — keep existing state
    }
  },

  refresh: async () => {
    if (!dbRef || !userIdRef) return;
    try {
      const currentOffset = get().offset;
      const reloadSize = Math.max(currentOffset, PAGE_SIZE);
      const rows = getTransactionsPaginated(dbRef, userIdRef, reloadSize, 0);
      const hasMore = rows.length > reloadSize;
      const pageData = hasMore ? rows.slice(0, reloadSize) : rows;

      // Skip pages update if data hasn't changed — avoids FlatList re-layout
      const currentPages = get().pages;
      const currentKey = currentPages.map((p) => `${p.id}:${p.updatedAt.getTime()}`).join(",");
      const newKey = pageData.map((r) => `${r.id}:${new Date(r.updatedAt).getTime()}`).join(",");
      const sameData = currentKey === newKey;

      if (!sameData) {
        set({
          pages: pageData.map(toStoredTransaction),
          offset: pageData.length,
          hasMore,
        });
      }
      get().loadAggregates();
    } catch {
      // Refresh failed — keep existing state
    }
  },

  saveTransaction: async () => {
    if (!dbRef || !userIdRef) {
      return { success: false as const, error: "Store not initialized" };
    }

    const { type, digits, categoryId, description, date } = get();
    const id = generateId("tx");
    const now = new Date();

    const result = buildTransaction(
      { type, digits, categoryId, description, date },
      userIdRef,
      id,
      now
    );
    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    const { transaction } = result;

    try {
      await insertTransaction(dbRef, toTransactionRow(transaction));

      await enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "transactions",
        rowId: transaction.id,
        operation: "insert",
        createdAt: now.toISOString(),
      });
    } catch {
      return { success: false as const, error: "Failed to save transaction" };
    }

    await get().refresh();

    return { success: true as const, transaction };
  },

  removeTransaction: async (id) => {
    if (dbRef) {
      try {
        const now = new Date().toISOString();
        await softDeleteTransaction(dbRef, id, now);
        await enqueueSync(dbRef, {
          id: generateId("sq"),
          tableName: "transactions",
          rowId: id,
          operation: "delete",
          createdAt: now,
        });
      } catch {
        // DB operation failed — keep UI state unchanged
        return;
      }
    }
    await get().refresh();
  },

  addToCache: (tx) => set((s) => ({ pages: [tx, ...s.pages], offset: s.offset + 1 })),

  removeFromCache: (id) =>
    set((s) => {
      const filtered = s.pages.filter((t) => t.id !== id);
      const removed = filtered.length < s.pages.length;
      return { pages: filtered, offset: removed ? Math.max(0, s.offset - 1) : s.offset };
    }),

  resetForm: () => set({ ...INITIAL_FORM, date: new Date() }),

  getChatData: (currentMonth) => {
    if (!dbRef || !userIdRef) {
      return {
        recentTransactions: [],
        balanceCents: get().balanceCents,
        categorySpending: get().categorySpending,
        previousMonthSpending: [],
      };
    }
    const prevMonth = previousMonth(currentMonth);
    const recentRows = getRecentTransactions(dbRef, userIdRef, currentMonth, prevMonth);
    const prevMonthSpending = getSpendingByCategoryAggregate(dbRef, userIdRef, prevMonth);
    return {
      recentTransactions: recentRows.map(toStoredTransaction),
      balanceCents: get().balanceCents,
      categorySpending: get().categorySpending,
      previousMonthSpending: prevMonthSpending,
    };
  },

  getTransactionById: (id) => {
    if (!dbRef) return null;
    const row = getTransactionById(dbRef, id);
    return row ? toStoredTransaction(row) : null;
  },
}));
