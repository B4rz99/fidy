import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import { buildTransaction, toStoredTransaction, toTransactionRow } from "./lib/build-transaction";
import type { CategoryId } from "./lib/categories";
import {
  enqueueSync,
  getAllTransactions,
  insertTransaction,
  softDeleteTransaction,
} from "./lib/repository";
import type { StoredTransaction, TransactionType } from "./schema";

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
      }));

      return { success: true as const, transaction };
    },

    loadTransactions: async () => {
      if (!dbRef || !userIdRef) return;
      try {
        const rows = await getAllTransactions(dbRef, userIdRef);
        set({ transactions: rows.map(toStoredTransaction) });
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
