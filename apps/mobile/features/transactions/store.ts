import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import { toIsoDate } from "@/shared/lib/format-date";
import { buildTransaction, toStoredTransaction, toTransactionRow } from "./lib/build-transaction";
import type { CategoryId } from "./lib/categories";
import {
  enqueueSync,
  getBalance,
  getCategorySpending,
  getDailySpending,
  getTransactionPage,
  insertTransaction,
  softDeleteTransaction,
  type TransactionCursor,
} from "./lib/repository";
import type { StoredTransaction, TransactionType } from "./schema";

type FormStep = 1 | 2;

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

const computeAggregates = () => {
  if (!dbRef || !userIdRef) return {};
  const now = new Date();
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const thirtyDaysAgo = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
  const todayStr = toIsoDate(now);

  return {
    balanceCents: getBalance(dbRef, userIdRef),
    categorySpending: getCategorySpending(dbRef, userIdRef, monthStart, monthEnd),
    dailySpending: getDailySpending(dbRef, userIdRef, thirtyDaysAgo, todayStr),
  };
};

type AddTransactionState = {
  // Form fields
  step: FormStep;
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
  description: string;
  date: Date;

  // Persisted transactions (UI cache from DB — accumulated pages)
  transactions: StoredTransaction[];

  // Pagination state
  cursor: TransactionCursor;
  hasMore: boolean;
  isLoadingMore: boolean;

  // Pre-computed aggregates
  balanceCents: number;
  categorySpending: readonly { categoryId: string; totalCents: number }[];
  dailySpending: readonly { date: string; totalCents: number }[];
};

type AddTransactionActions = {
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
  loadInitialData: () => void;
  loadTransactions: () => Promise<void>;
  loadNextPage: () => void;
  removeTransaction: (id: string) => Promise<void>;
  addToCache: (tx: StoredTransaction) => void;
  removeFromCache: (id: string) => void;
  resetForm: () => void;
};

const INITIAL_FORM: Pick<
  AddTransactionState,
  "step" | "type" | "digits" | "categoryId" | "description"
> = {
  step: 1,
  type: "expense",
  digits: "",
  categoryId: null,
  description: "",
};

export const useTransactionStore = create<AddTransactionState & AddTransactionActions>(
  (set, get) => ({
    ...INITIAL_FORM,
    date: new Date(),
    transactions: [],
    cursor: null,
    hasMore: false,
    isLoadingMore: false,
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

      set((state) => ({
        transactions: [transaction, ...state.transactions],
        ...computeAggregates(),
      }));

      return { success: true as const, transaction };
    },

    loadInitialData: () => {
      if (!dbRef || !userIdRef) return;
      const aggregates = computeAggregates();
      const page = getTransactionPage(dbRef, userIdRef, null, 50);

      const lastTx = page.at(-1);
      const cursor: TransactionCursor = lastTx
        ? { date: toIsoDate(lastTx.date), createdAt: lastTx.createdAt.toISOString(), id: lastTx.id }
        : null;

      set({
        transactions: page,
        cursor,
        hasMore: page.length === 50,
        ...aggregates,
      });
    },

    loadTransactions: async () => {
      get().loadInitialData();
    },

    loadNextPage: () => {
      const { isLoadingMore, hasMore, cursor, transactions } = get();
      if (isLoadingMore || !hasMore || !dbRef || !userIdRef) return;
      set({ isLoadingMore: true });

      const page = getTransactionPage(dbRef, userIdRef, cursor, 50);
      const lastTx = page.at(-1);
      const newCursor: TransactionCursor = lastTx
        ? { date: toIsoDate(lastTx.date), createdAt: lastTx.createdAt.toISOString(), id: lastTx.id }
        : cursor;

      set({
        transactions: [...transactions, ...page],
        cursor: newCursor,
        hasMore: page.length === 50,
        isLoadingMore: false,
      });
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
      set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
        ...computeAggregates(),
      }));
    },

    // Precondition: tx must already be persisted to DB (computeAggregates re-queries SQL)
    addToCache: (tx) =>
      set((s) => ({
        transactions: [tx, ...s.transactions],
        ...computeAggregates(),
      })),

    // Precondition: tx must already be soft-deleted in DB (computeAggregates re-queries SQL)
    removeFromCache: (id) =>
      set((s) => ({
        transactions: s.transactions.filter((t) => t.id !== id),
        ...computeAggregates(),
      })),

    resetForm: () => set({ ...INITIAL_FORM, date: new Date() }),
  })
);
