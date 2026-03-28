import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  generateSyncQueueId,
  generateTransactionId,
  toIsoDate,
  toIsoDateTime,
  toMonth,
  trackTransactionDeleted,
  trackTransactionEdited,
} from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate, TransactionId, UserId } from "@/shared/types/branded";
import { buildTransaction, toStoredTransaction, toTransactionRow } from "./lib/build-transaction";
import {
  getDailySpendingAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
  insertTransaction,
  softDeleteTransaction,
  upsertTransaction,
} from "./lib/repository";
import type { StoredTransaction, TransactionType } from "./schema";

type FormStep = 1 | 2;

const PAGE_SIZE = 30;

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;

type CategorySpendingItem = {
  readonly categoryId: CategoryId;
  readonly total: CopAmount;
};

type DailySpendingItem = {
  readonly date: IsoDate;
  readonly total: CopAmount;
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
  balance: number;
  categorySpending: CategorySpendingItem[];
  dailySpending: DailySpendingItem[];
};

type TransactionActions = {
  initStore: (db: AnyDb, userId: UserId) => void;
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
  removeTransaction: (id: TransactionId) => Promise<void>;
  editTransaction: (id: TransactionId) => void;
  updateTransaction: (
    id: TransactionId
  ) => Promise<
    { success: true; transaction: StoredTransaction } | { success: false; error: string }
  >;
  updateTransactionDirect: (
    id: TransactionId,
    fields: {
      type: TransactionType;
      digits: string;
      categoryId: CategoryId | null;
      description: string;
      date: Date;
    }
  ) => Promise<
    { success: true; transaction: StoredTransaction } | { success: false; error: string }
  >;
  deleteTransaction: (id: TransactionId) => Promise<void>;
  addToCache: (tx: StoredTransaction) => void;
  removeFromCache: (id: TransactionId) => void;
  resetForm: () => void;
  getTransactionById: (id: TransactionId) => StoredTransaction | null;

  // Edit mode
  editingId: TransactionId | null;
};

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
  balance: 0,
  categorySpending: [],
  dailySpending: [],
  editingId: null,

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
      const currentMonth = toMonth(now);
      const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      const startDate = toIsoDate(thirtyDaysAgo);
      const endDate = toIsoDate(now);

      const categorySpending = getSpendingByCategoryAggregate(dbRef, userIdRef, currentMonth);
      const balance = categorySpending.reduce((sum, c) => sum + c.total, 0) as CopAmount;
      const dailySpending = getDailySpendingAggregate(dbRef, userIdRef, startDate, endDate);

      set({ balance, categorySpending, dailySpending });
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
    const id = generateTransactionId();
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
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: transaction.id,
        operation: "insert",
        createdAt: toIsoDateTime(now),
      });
    } catch {
      return { success: false as const, error: "Failed to save transaction" };
    }

    await get().refresh();

    return { success: true as const, transaction };
  },

  removeTransaction: async (id) => {
    if (dbRef) {
      const now = toIsoDateTime(new Date());
      await softDeleteTransaction(dbRef, id, now);
      await enqueueSync(dbRef, {
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: id,
        operation: "delete",
        createdAt: now,
      });
      trackTransactionDeleted();
    }
    await get().refresh();
  },

  editTransaction: (id) => {
    if (!dbRef) return;
    const row = getTransactionById(dbRef, id);
    if (!row) return;
    const tx = toStoredTransaction(row);
    set({
      editingId: id,
      type: tx.type,
      digits: String(tx.amount),
      categoryId: tx.categoryId,
      description: tx.description,
      date: tx.date,
    });
  },

  updateTransaction: async (id) => {
    if (!dbRef || !userIdRef) {
      return { success: false as const, error: "Store not initialized" };
    }

    const { type, digits, categoryId, description, date } = get();
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
      upsertTransaction(dbRef, toTransactionRow(transaction));

      await enqueueSync(dbRef, {
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: id,
        operation: "update",
        createdAt: toIsoDateTime(now),
      });
    } catch {
      return { success: false as const, error: "Failed to update transaction" };
    }

    trackTransactionEdited({ category: String(transaction.categoryId) });
    get().resetForm();
    await get().refresh();

    return { success: true as const, transaction };
  },

  updateTransactionDirect: async (id, fields) => {
    if (!dbRef || !userIdRef) {
      return { success: false as const, error: "Store not initialized" };
    }

    const now = new Date();

    const result = buildTransaction(fields, userIdRef, id, now);
    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    const { transaction } = result;

    try {
      upsertTransaction(dbRef, toTransactionRow(transaction));

      await enqueueSync(dbRef, {
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: id,
        operation: "update",
        createdAt: toIsoDateTime(now),
      });
    } catch {
      return { success: false as const, error: "Failed to update transaction" };
    }

    trackTransactionEdited({ category: String(transaction.categoryId) });
    await get().refresh();

    return { success: true as const, transaction };
  },

  deleteTransaction: async (id) => {
    await get().removeTransaction(id);
  },

  addToCache: (tx) => set((s) => ({ pages: [tx, ...s.pages], offset: s.offset + 1 })),

  removeFromCache: (id) =>
    set((s) => {
      const filtered = s.pages.filter((t) => t.id !== id);
      const removed = filtered.length < s.pages.length;
      return { pages: filtered, offset: removed ? Math.max(0, s.offset - 1) : s.offset };
    }),

  resetForm: () => set({ ...INITIAL_FORM, date: new Date(), editingId: null }),

  getTransactionById: (id) => {
    if (!dbRef) return null;
    const row = getTransactionById(dbRef, id);
    return row ? toStoredTransaction(row) : null;
  },
}));
