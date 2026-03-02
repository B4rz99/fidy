import { create } from "zustand";
import type { CategoryId } from "./lib/categories";
import { amountToCents } from "./lib/format-amount";
import type { CreateTransactionInput, StoredTransaction, TransactionType } from "./schema";
import { createTransactionSchema } from "./schema";

type SheetStep = 1 | 2;

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

  // Saved transactions (in-memory for now)
  transactions: StoredTransaction[];
};

type AddTransactionActions = {
  openSheet: () => void;
  closeSheet: () => void;
  setStep: (step: SheetStep) => void;
  setType: (type: TransactionType) => void;
  setDigits: (digits: string) => void;
  setCategoryId: (id: CategoryId) => void;
  setDescription: (desc: string) => void;
  setDate: (date: Date) => void;
  saveTransaction: () =>
    | { success: true; transaction: StoredTransaction }
    | { success: false; error: string };
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

    openSheet: () => set({ isOpen: true, ...INITIAL_FORM, date: new Date() }),
    closeSheet: () => set({ isOpen: false, ...INITIAL_FORM, date: new Date() }),
    setStep: (step) => set({ step }),
    setType: (type) => set({ type }),
    setDigits: (digits) => set({ digits }),
    setCategoryId: (categoryId) => set({ categoryId }),
    setDescription: (description) => set({ description }),
    setDate: (date) => set({ date }),

    saveTransaction: () => {
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

      set((state) => ({
        transactions: [transaction, ...state.transactions],
      }));

      return { success: true as const, transaction };
    },

    resetForm: () => set({ ...INITIAL_FORM, date: new Date() }),
  })
);
