import { toIsoDate, toMonth } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import { upsertStoredTransactionByRepositoryOrder } from "../lib/transaction-order";
import type { StoredTransaction } from "../schema";
import type { TransactionActions, TransactionSetState, TransactionState } from "./state";

const addCopAmount = (left: number, right: number): CopAmount => (left + right) as CopAmount;

function isCurrentMonthExpense(transaction: StoredTransaction, now: Date): boolean {
  return transaction.type === "expense" && toMonth(transaction.date) === toMonth(now);
}

function isRecentDailyExpense(transaction: StoredTransaction, now: Date): boolean {
  if (transaction.type !== "expense") return false;
  const inclusiveThirtyDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const transactionDate = toIsoDate(transaction.date);

  return transactionDate >= toIsoDate(inclusiveThirtyDayStart) && transactionDate <= toIsoDate(now);
}

function upsertCategorySpending(
  items: TransactionState["categorySpending"],
  transaction: StoredTransaction
): TransactionState["categorySpending"] {
  const didUpdate = items.some((item) => item.categoryId === transaction.categoryId);
  const nextItems = didUpdate
    ? items.map((item) =>
        item.categoryId === transaction.categoryId
          ? { ...item, total: addCopAmount(item.total, transaction.amount) }
          : item
      )
    : [...items, { categoryId: transaction.categoryId, total: transaction.amount }];

  return nextItems.slice().sort((left, right) => right.total - left.total);
}

function upsertDailySpending(
  items: TransactionState["dailySpending"],
  transaction: StoredTransaction
): TransactionState["dailySpending"] {
  const date = toIsoDate(transaction.date);
  const didUpdate = items.some((item) => item.date === date);
  const nextItems = didUpdate
    ? items.map((item) =>
        item.date === date ? { ...item, total: addCopAmount(item.total, transaction.amount) } : item
      )
    : [...items, { date, total: transaction.amount }];

  return nextItems.slice().sort((left, right) => left.date.localeCompare(right.date));
}

export function setTransactionPageSnapshot(
  set: TransactionSetState
): TransactionActions["setPageSnapshot"] {
  return function setPageSnapshot(snapshot) {
    set({
      pages: [...snapshot.pages],
      offset: snapshot.offset,
      hasMore: snapshot.hasMore,
    });
  };
}

export function appendTransactionPageSnapshot(
  set: TransactionSetState
): TransactionActions["appendPageSnapshot"] {
  return function appendPageSnapshot(snapshot) {
    set((state) => ({
      pages: [...state.pages, ...snapshot.pages],
      offset: state.offset + snapshot.pages.length,
      hasMore: snapshot.hasMore,
    }));
  };
}

export function setTransactionAggregateSnapshot(
  set: TransactionSetState
): TransactionActions["setAggregateSnapshot"] {
  return function setAggregateSnapshot(snapshot) {
    set({
      balance: snapshot.balance,
      categorySpending: [...snapshot.categorySpending],
      dailySpending: [...snapshot.dailySpending],
    });
  };
}

export function createHydrateEditingTransaction(
  set: TransactionSetState
): TransactionActions["hydrateEditingTransaction"] {
  return function hydrateEditingTransaction(id, transaction) {
    set({
      editingId: id,
      type: transaction.type,
      digits: String(transaction.amount),
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      description: transaction.description,
      date: transaction.date,
    });
  };
}

export function addTransactionToCache(set: TransactionSetState): TransactionActions["addToCache"] {
  return function addToCache(transaction, options) {
    const now = new Date();
    const countInPagination = options?.countInPagination ?? true;
    set((state) => {
      const isMonthlyExpense = isCurrentMonthExpense(transaction, now);
      const isDailyExpense = isRecentDailyExpense(transaction, now);

      return {
        pages: upsertStoredTransactionByRepositoryOrder(state.pages, transaction),
        offset: countInPagination ? state.offset + 1 : state.offset,
        balance: isMonthlyExpense ? state.balance + transaction.amount : state.balance,
        categorySpending: isMonthlyExpense
          ? upsertCategorySpending(state.categorySpending, transaction)
          : state.categorySpending,
        dailySpending: isDailyExpense
          ? upsertDailySpending(state.dailySpending, transaction)
          : state.dailySpending,
        dataRevision: state.dataRevision + 1,
      };
    });
  };
}

export function removeTransactionFromCache(
  set: TransactionSetState
): TransactionActions["removeFromCache"] {
  return function removeFromCache(id) {
    set((state) => {
      const pages = state.pages.filter((transaction) => transaction.id !== id);
      const removed = pages.length < state.pages.length;

      return {
        pages,
        offset: removed ? Math.max(0, state.offset - 1) : state.offset,
        dataRevision: removed ? state.dataRevision + 1 : state.dataRevision,
      };
    });
  };
}

export function setTransactionRefreshSnapshot(
  set: TransactionSetState
): TransactionActions["applyRefreshSnapshot"] {
  return function applyRefreshSnapshot(snapshot) {
    set((state) => ({
      ...(snapshot.sameData ? null : { pages: [...snapshot.pages] }),
      offset: snapshot.offset,
      hasMore: snapshot.hasMore,
      balance: snapshot.balance,
      categorySpending: [...snapshot.categorySpending],
      dailySpending: [...snapshot.dailySpending],
      dataRevision: state.dataRevision + 1,
    }));
  };
}
