import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import { parseIsoDate, toIsoDate } from "@/shared/lib/format-date";
import { generateId } from "@/shared/lib/generate-id";
import type { CategoryId } from "./lib/categories";
import { amountToCents } from "./lib/format-amount";
import {
  enqueueSync,
  getAllTransactions,
  insertTransaction,
  softDeleteTransaction,
} from "./lib/repository";
import type { CreateTransactionInput, StoredTransaction, TransactionType } from "./schema";
import { createTransactionSchema } from "./schema";

type SheetStep = 1 | 2;

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

type AddTransactionState = {
  // Sheet visibility
  isOpen: boolean;
  step: SheetStep;

  // Form fields
  type: TransactionType;
  digits: string;
  categoryId: CategoryId | null;
  description: string;
  date: Date;

  // Persisted transactions (UI cache from DB)
  transactions: StoredTransaction[];
};

type AddTransactionActions = {
  initStore: (db: AnyDb, userId: string) => void;
  openSheet: () => void;
  closeSheet: () => void;
  setStep: (step: SheetStep) => void;
  setType: (type: TransactionType) => void;
  setDigits: (digits: string) => void;
  setCategoryId: (id: CategoryId) => void;
  setDescription: (desc: string) => void;
  setDate: (date: Date) => void;
  saveTransaction: () => Promise<
    { success: true; transaction: StoredTransaction } | { success: false; error: string }
  >;
  loadTransactions: () => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
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
    isOpen: false,
    ...INITIAL_FORM,
    date: new Date(),
    transactions: [],

    initStore: (db, userId) => {
      dbRef = db;
      userIdRef = userId;
    },

    openSheet: () => set({ isOpen: true, ...INITIAL_FORM, date: new Date() }),
    closeSheet: () => set({ isOpen: false, ...INITIAL_FORM, date: new Date() }),
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
      const amountCents = amountToCents(digits);

      const input: CreateTransactionInput = {
        type,
        amountCents,
        categoryId: categoryId ?? "other",
        description: description || undefined,
        date,
      };

      const result = createTransactionSchema.safeParse(input);
      if (!result.success) {
        return {
          success: false as const,
          error: result.error.issues[0]?.message ?? "Invalid input",
        };
      }

      const now = new Date();
      const transaction: StoredTransaction = {
        id: generateId("tx"),
        userId: userIdRef,
        type: result.data.type,
        amountCents: result.data.amountCents,
        categoryId: result.data.categoryId as CategoryId,
        description: result.data.description ?? "",
        date: result.data.date,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      try {
        await insertTransaction(dbRef, {
          id: transaction.id,
          userId: transaction.userId,
          type: transaction.type,
          amountCents: transaction.amountCents,
          categoryId: transaction.categoryId,
          description: transaction.description || null,
          date: toIsoDate(transaction.date),
          createdAt: transaction.createdAt.toISOString(),
          updatedAt: transaction.updatedAt.toISOString(),
        });

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
      }));

      return { success: true as const, transaction };
    },

    loadTransactions: async () => {
      if (!dbRef || !userIdRef) return;
      try {
        const rows = await getAllTransactions(dbRef, userIdRef);
        const transactions: StoredTransaction[] = rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          type: row.type as TransactionType,
          amountCents: row.amountCents,
          categoryId: row.categoryId as CategoryId,
          description: row.description ?? "",
          date: parseIsoDate(row.date),
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
        }));
        set({ transactions });
      } catch {
        // DB read failed — keep existing in-memory state
      }
    },

    removeTransaction: async (id) => {
      if (dbRef) {
        try {
          await softDeleteTransaction(dbRef, id);
          await enqueueSync(dbRef, {
            id: generateId("sq"),
            tableName: "transactions",
            rowId: id,
            operation: "delete",
            createdAt: new Date().toISOString(),
          });
        } catch {
          // DB operation failed — keep UI state unchanged
          return;
        }
      }
      set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
      }));
    },

    resetForm: () => set({ ...INITIAL_FORM, date: new Date() }),
  })
);
