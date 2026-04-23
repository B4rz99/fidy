import type { TransactionActions, TransactionSetState } from "./state";

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
  return function addToCache(transaction) {
    set((state) => ({
      pages: [transaction, ...state.pages],
      offset: state.offset + 1,
      dataRevision: state.dataRevision + 1,
    }));
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
