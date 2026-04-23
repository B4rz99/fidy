import type { CategoryId, FinancialAccountId, TransactionId, UserId } from "@/shared/types/branded";
import type { TransactionActions, TransactionSetState, TransactionState } from "./state";

const INITIAL_FORM: Pick<
  TransactionState,
  "step" | "type" | "digits" | "categoryId" | "accountId" | "description"
> = {
  step: 1,
  type: "expense",
  digits: "",
  categoryId: null,
  accountId: null,
  description: "",
};

const INITIAL_PAGINATION_STATE: Pick<TransactionState, "pages" | "offset" | "hasMore"> = {
  pages: [],
  offset: 0,
  hasMore: true,
};

const INITIAL_AGGREGATE_STATE: Pick<
  TransactionState,
  "balance" | "categorySpending" | "dailySpending" | "dataRevision"
> = {
  balance: 0,
  categorySpending: [],
  dailySpending: [],
  dataRevision: 0,
};

export function createInitialTransactionState(activeUserId: UserId | null): TransactionState {
  return {
    activeUserId,
    ...INITIAL_FORM,
    defaultAccountId: null,
    date: new Date(),
    ...INITIAL_PAGINATION_STATE,
    ...INITIAL_AGGREGATE_STATE,
    editingId: null,
  };
}

export function beginTransactionSession(
  set: TransactionSetState
): TransactionActions["beginSession"] {
  return function beginSession(userId) {
    set(createInitialTransactionState(userId));
  };
}

export function setTransactionStep(set: TransactionSetState): TransactionActions["setStep"] {
  return function setStep(step) {
    set({ step });
  };
}

export function setTransactionType(set: TransactionSetState): TransactionActions["setType"] {
  return function setType(type) {
    set({ type });
  };
}

export function setTransactionDigits(set: TransactionSetState): TransactionActions["setDigits"] {
  return function setDigits(digits) {
    set((state) => ({
      digits: typeof digits === "function" ? digits(state.digits) : digits,
    }));
  };
}

export function setTransactionCategoryId(
  set: TransactionSetState
): TransactionActions["setCategoryId"] {
  return function setCategoryId(categoryId: CategoryId) {
    set({ categoryId });
  };
}

export function setTransactionDefaultAccount(
  set: TransactionSetState
): TransactionActions["setDefaultAccountId"] {
  return function setDefaultAccountId(defaultAccountId) {
    set((state) => ({
      defaultAccountId,
      accountId:
        state.editingId == null &&
        (state.accountId == null || state.accountId === state.defaultAccountId)
          ? defaultAccountId
          : state.accountId,
    }));
  };
}

export function setTransactionAccountId(
  set: TransactionSetState
): TransactionActions["setAccountId"] {
  return function setAccountId(accountId: FinancialAccountId | null) {
    set({ accountId });
  };
}

export function setTransactionDescription(
  set: TransactionSetState
): TransactionActions["setDescription"] {
  return function setDescription(description) {
    set({ description });
  };
}

export function setTransactionDate(set: TransactionSetState): TransactionActions["setDate"] {
  return function setDate(date) {
    set({ date });
  };
}

export function resetTransactionForm(set: TransactionSetState): TransactionActions["resetForm"] {
  return function resetForm() {
    set((state) => ({
      ...INITIAL_FORM,
      accountId: state.defaultAccountId,
      date: new Date(),
      editingId: null as TransactionId | null,
    }));
  };
}
