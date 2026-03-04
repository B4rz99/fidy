import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

// biome-ignore lint/suspicious/noExplicitAny: drizzle generic varies by caller
type AnyDb = ExpoSQLiteDatabase<any>;

import { create } from "zustand";
import { toIsoDate } from "@/shared/lib/format-date";
import type { CategoryId } from "./lib/categories";
import { amountToCents } from "./lib/format-amount";
import {
  deleteTransaction as deleteTransactionRepo,
  getAllTransactions,
  insertTransaction,
} from "./lib/repository";
import type { CreateTransactionInput, StoredTransaction, TransactionType } from "./schema";
import { createTransactionSchema } from "./schema";

type SheetStep = 1 | 2;

let dbRef: AnyDb | null = null;

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
  initStore: (db: AnyDb) => void;
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

    initStore: (db) => {
      dbRef = db;
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

      const transaction: StoredTransaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: result.data.type,
        amountCents: result.data.amountCents,
        categoryId: result.data.categoryId as CategoryId,
        description: result.data.description ?? "",
        date: result.data.date,
        createdAt: new Date(),
      };

      if (dbRef) {
        await insertTransaction(dbRef, {
          id: transaction.id,
          type: transaction.type,
          amountCents: transaction.amountCents,
          categoryId: transaction.categoryId,
          description: transaction.description || null,
          date: toIsoDate(transaction.date),
          createdAt: transaction.createdAt.toISOString(),
        });
      }

      set((state) => ({
        transactions: [transaction, ...state.transactions],
      }));

      return { success: true as const, transaction };
    },

    loadTransactions: async () => {
      if (!dbRef) return;
      const rows = await getAllTransactions(dbRef);
      const transactions: StoredTransaction[] = rows.map((row) => ({
        id: row.id,
        type: row.type as TransactionType,
        amountCents: row.amountCents,
        categoryId: row.categoryId as CategoryId,
        description: row.description ?? "",
        date: new Date(row.date),
        createdAt: new Date(row.createdAt),
      }));
      set({ transactions });
    },

    removeTransaction: async (id) => {
      if (dbRef) {
        await deleteTransactionRepo(dbRef, id);
      }
      set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
      }));
    },

    resetForm: () => set({ ...INITIAL_FORM, date: new Date() }),
  })
);
