import { create, type StateCreator } from "zustand";
import type { CategoryId, FinancialAccountId, TransactionId, UserId } from "@/shared/types/branded";
import type { DigitsInput } from "../components/transaction-form/TransactionForm.types";
import type { StoredTransaction, TransactionType } from "../schema";
import type {
  CategorySpendingItem,
  DailySpendingItem,
  TransactionAggregateSnapshot,
  TransactionPageSnapshot,
  TransactionRefreshSnapshot,
} from "../services/create-transaction-query-service";
import {
  beginTransactionSession,
  createInitialTransactionState,
  resetTransactionForm,
  setTransactionAccountId,
  setTransactionCategoryId,
  setTransactionDate,
  setTransactionDefaultAccount,
  setTransactionDescription,
  setTransactionDigits,
  setTransactionStep,
  setTransactionType,
} from "./form-actions";
import {
  addTransactionToCache,
  appendTransactionPageSnapshot,
  createHydrateEditingTransaction,
  removeTransactionFromCache,
  setTransactionAggregateSnapshot,
  setTransactionPageSnapshot,
  setTransactionRefreshSnapshot,
} from "./page-actions";

export type FormStep = 1 | 2;

export type TransactionState = {
  readonly activeUserId: UserId | null;
  readonly step: FormStep;
  readonly type: TransactionType;
  readonly digits: string;
  readonly categoryId: CategoryId | null;
  readonly defaultAccountId: FinancialAccountId | null;
  readonly accountId: FinancialAccountId | null;
  readonly description: string;
  readonly date: Date;
  readonly pages: readonly StoredTransaction[];
  readonly offset: number;
  readonly hasMore: boolean;
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly dailySpending: readonly DailySpendingItem[];
  readonly dataRevision: number;
  readonly editingId: TransactionId | null;
};

export type TransactionActions = {
  beginSession: (userId: UserId) => void;
  setStep: (step: FormStep) => void;
  setType: (type: TransactionType) => void;
  setDigits: (digits: DigitsInput) => void;
  setCategoryId: (id: CategoryId) => void;
  setDefaultAccountId: (id: FinancialAccountId | null) => void;
  setAccountId: (id: FinancialAccountId | null) => void;
  setDescription: (desc: string) => void;
  setDate: (date: Date) => void;
  setPageSnapshot: (snapshot: TransactionPageSnapshot) => void;
  appendPageSnapshot: (snapshot: TransactionPageSnapshot) => void;
  setAggregateSnapshot: (snapshot: TransactionAggregateSnapshot) => void;
  applyRefreshSnapshot: (snapshot: TransactionRefreshSnapshot) => void;
  hydrateEditingTransaction: (id: TransactionId, transaction: StoredTransaction) => void;
  addToCache: (tx: StoredTransaction) => void;
  removeFromCache: (id: TransactionId) => void;
  resetForm: () => void;
};

export type TransactionStore = TransactionState & TransactionActions;
export type TransactionSetState = Parameters<StateCreator<TransactionStore>>[0];

export const createTransactionStoreState: StateCreator<TransactionStore> = (set) => ({
  ...createInitialTransactionState(null),
  beginSession: beginTransactionSession(set),
  setStep: setTransactionStep(set),
  setType: setTransactionType(set),
  setDigits: setTransactionDigits(set),
  setCategoryId: setTransactionCategoryId(set),
  setDefaultAccountId: setTransactionDefaultAccount(set),
  setAccountId: setTransactionAccountId(set),
  setDescription: setTransactionDescription(set),
  setDate: setTransactionDate(set),
  setPageSnapshot: setTransactionPageSnapshot(set),
  appendPageSnapshot: appendTransactionPageSnapshot(set),
  setAggregateSnapshot: setTransactionAggregateSnapshot(set),
  applyRefreshSnapshot: setTransactionRefreshSnapshot(set),
  hydrateEditingTransaction: createHydrateEditingTransaction(set),
  addToCache: addTransactionToCache(set),
  removeFromCache: removeTransactionFromCache(set),
  resetForm: resetTransactionForm(set),
});

export const useTransactionStore = create(createTransactionStoreState);
