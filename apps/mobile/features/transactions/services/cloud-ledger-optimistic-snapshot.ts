import {
  getCloudLedgerOutbox,
  type CloudLedgerPendingChange,
} from "@/features/cloud-ledger/outbox.public";
import { getCloudLedgerRuntimeCache } from "@/features/cloud-ledger/runtime.public";
import { toIsoDate, toMonth } from "@/shared/lib";
import { requireCopAmount } from "@/shared/types/assertions";
import type { CopAmount, TransactionId, UserId } from "@/shared/types/branded";
import {
  compareStoredTransactionsByRepositoryOrder,
  upsertStoredTransactionByRepositoryOrder,
} from "../lib/transaction-order";
import type { StoredTransaction } from "../schema";
import {
  cloudLedgerTransactionToStoredTransactions,
  pendingCloudLedgerChangeToDeletedTransactionIds,
  pendingCloudLedgerChangeToStoredTransactions,
} from "./cloud-ledger-transaction-adapter";
import type {
  CategorySpendingItem,
  DailySpendingItem,
  TransactionAggregateSnapshot,
  TransactionPageSnapshot,
} from "./create-transaction-query-service";

type TransactionSnapshot = TransactionPageSnapshot & TransactionAggregateSnapshot;
type ApplyCloudLedgerTransactionsOptions = {
  readonly aggregateReplacementTransactionIds?: ReadonlySet<TransactionId>;
  readonly getTransactionIncludedInAggregate?: (
    transaction: StoredTransaction
  ) => StoredTransaction | null;
  readonly getTransactionIncludedInAggregateById?: (
    transactionId: TransactionId
  ) => StoredTransaction | null;
  readonly isTransactionIncludedInAggregate?: (transaction: StoredTransaction) => boolean;
  readonly isTransactionIncludedInPageOffset?: (transaction: StoredTransaction) => boolean;
  readonly pageWindowSize?: number;
};
type ApplyCloudLedgerTransactionsRuntime = {
  readonly aggregateReplacementTransactionIds: ReadonlySet<TransactionId>;
  readonly isTransactionIncludedInPageOffset: (transaction: StoredTransaction) => boolean;
  readonly now: Date;
};
export type CloudLedgerOptimisticTransactionOverlay = {
  readonly deletedTransactionIds: readonly TransactionId[];
  readonly transactions: readonly StoredTransaction[];
};

const addCopAmount = (left: number, right: number): CopAmount => requireCopAmount(left + right);

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
  items: readonly CategorySpendingItem[],
  transaction: StoredTransaction
): readonly CategorySpendingItem[] {
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
  items: readonly DailySpendingItem[],
  transaction: StoredTransaction
): readonly DailySpendingItem[] {
  const date = toIsoDate(transaction.date);
  const didUpdate = items.some((item) => item.date === date);
  const nextItems = didUpdate
    ? items.map((item) =>
        item.date === date ? { ...item, total: addCopAmount(item.total, transaction.amount) } : item
      )
    : [...items, { date, total: transaction.amount }];

  return nextItems.slice().sort((left, right) => left.date.localeCompare(right.date));
}

function subtractSpendingTotal(total: CopAmount, amount: CopAmount): CopAmount | null {
  const nextTotal = total - amount;
  return nextTotal > 0 ? requireCopAmount(nextTotal) : null;
}

function removeCategorySpending(
  items: readonly CategorySpendingItem[],
  transaction: StoredTransaction
): readonly CategorySpendingItem[] {
  return items.flatMap((item) => {
    if (item.categoryId !== transaction.categoryId) return [item];
    const total = subtractSpendingTotal(item.total, transaction.amount);
    return total === null ? [] : [{ ...item, total }];
  });
}

function removeDailySpending(
  items: readonly DailySpendingItem[],
  transaction: StoredTransaction
): readonly DailySpendingItem[] {
  const date = toIsoDate(transaction.date);
  return items.flatMap((item) => {
    if (item.date !== date) return [item];
    const total = subtractSpendingTotal(item.total, transaction.amount);
    return total === null ? [] : [{ ...item, total }];
  });
}

function upsertCloudLedgerTransaction(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  pageWindowSize: number | undefined,
  isTransactionIncludedInPageOffset: (transaction: StoredTransaction) => boolean
): {
  readonly snapshot: TransactionSnapshot;
  readonly replacedTransaction: StoredTransaction | null;
} {
  const replacedTransaction = snapshot.pages.find((page) => page.id === transaction.id) ?? null;
  const shouldInsertIntoPages = shouldInsertTransactionIntoPages(
    snapshot,
    transaction,
    pageWindowSize
  );
  const pages = shouldInsertIntoPages
    ? trimPagesToWindow(
        upsertStoredTransactionByRepositoryOrder(snapshot.pages, transaction),
        pageWindowSize
      )
    : snapshot.pages;
  const droppedCommittedPageCount = countDroppedCommittedPages(
    snapshot.pages,
    pages,
    isTransactionIncludedInPageOffset
  );

  return {
    snapshot: {
      ...snapshot,
      pages,
      offset: Math.max(0, snapshot.offset - droppedCommittedPageCount),
    },
    replacedTransaction,
  };
}

const countDroppedCommittedPages = (
  before: readonly StoredTransaction[],
  after: readonly StoredTransaction[],
  isTransactionIncludedInPageOffset: (transaction: StoredTransaction) => boolean
): number => {
  const afterIds = new Set(after.map((transaction) => transaction.id));
  return before.filter(
    (transaction) => isTransactionIncludedInPageOffset(transaction) && !afterIds.has(transaction.id)
  ).length;
};

const hasTransactionInPages = (
  pages: readonly StoredTransaction[],
  transaction: StoredTransaction
): boolean => pages.some((page) => page.id === transaction.id);

const hasPageWindowCapacity = (
  pages: readonly StoredTransaction[],
  pageWindowSize: number | undefined
): boolean => pageWindowSize == null || pages.length < pageWindowSize;

const sortsIntoVisibleWindow = (
  pages: readonly StoredTransaction[],
  transaction: StoredTransaction
): boolean => {
  const lastVisibleTransaction = pages[pages.length - 1];
  return (
    lastVisibleTransaction != null &&
    compareStoredTransactionsByRepositoryOrder(transaction, lastVisibleTransaction) <= 0
  );
};

const shouldInsertTransactionIntoPages = (
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  pageWindowSize: number | undefined
): boolean =>
  hasTransactionInPages(snapshot.pages, transaction) ||
  hasPageWindowCapacity(snapshot.pages, pageWindowSize) ||
  sortsIntoVisibleWindow(snapshot.pages, transaction);

function deletedAggregateTransactions(input: {
  readonly options: ApplyCloudLedgerTransactionsOptions;
  readonly removedPageTransactions: readonly StoredTransaction[];
  readonly transactionIds: readonly TransactionId[];
}): readonly StoredTransaction[] {
  const removedPageTransactionsById = new Map(
    input.removedPageTransactions.map((transaction) => [transaction.id, transaction])
  );
  return input.transactionIds.flatMap((transactionId) => {
    const removedPageTransaction = removedPageTransactionsById.get(transactionId);
    if (removedPageTransaction !== undefined) return [removedPageTransaction];
    const aggregateTransaction =
      input.options.getTransactionIncludedInAggregateById?.(transactionId);
    return aggregateTransaction == null ? [] : [aggregateTransaction];
  });
}

const trimPagesToWindow = (
  pages: readonly StoredTransaction[],
  pageWindowSize: number | undefined
): readonly StoredTransaction[] =>
  pageWindowSize == null ? pages : pages.slice(0, pageWindowSize);

function addCloudLedgerTransactionToSnapshot(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  options: ApplyCloudLedgerTransactionsOptions,
  runtime: ApplyCloudLedgerTransactionsRuntime
): TransactionSnapshot {
  const cloudLedgerSnapshot = upsertCloudLedgerTransaction(
    snapshot,
    transaction,
    options.pageWindowSize,
    runtime.isTransactionIncludedInPageOffset
  );
  const aggregateTransaction = runtime.aggregateReplacementTransactionIds.has(transaction.id)
    ? (options.getTransactionIncludedInAggregate?.(transaction) ??
      cloudLedgerSnapshot.replacedTransaction)
    : null;

  if (options.isTransactionIncludedInAggregate?.(transaction) === true) {
    return aggregateTransaction == null
      ? cloudLedgerSnapshot.snapshot
      : replaceCloudLedgerTransactionInAggregates(
          cloudLedgerSnapshot.snapshot,
          aggregateTransaction,
          transaction,
          runtime.now
        );
  }

  return addCloudLedgerTransactionToAggregates(
    cloudLedgerSnapshot.snapshot,
    transaction,
    runtime.now
  );
}

function replaceCloudLedgerTransactionInAggregates(
  snapshot: TransactionSnapshot,
  previousTransaction: StoredTransaction,
  nextTransaction: StoredTransaction,
  now: Date
): TransactionSnapshot {
  return addCloudLedgerTransactionToAggregates(
    removeCloudLedgerTransactionFromAggregates(snapshot, previousTransaction, now),
    nextTransaction,
    now
  );
}

function addCloudLedgerTransactionToAggregates(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  now: Date
): TransactionSnapshot {
  const isMonthlyExpense = isCurrentMonthExpense(transaction, now);
  const isDailyExpense = isRecentDailyExpense(transaction, now);

  return {
    ...snapshot,
    balance: isMonthlyExpense ? snapshot.balance + transaction.amount : snapshot.balance,
    categorySpending: isMonthlyExpense
      ? upsertCategorySpending(snapshot.categorySpending, transaction)
      : snapshot.categorySpending,
    dailySpending: isDailyExpense
      ? upsertDailySpending(snapshot.dailySpending, transaction)
      : snapshot.dailySpending,
  };
}

function removeCloudLedgerTransactionFromAggregates(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  now: Date
): TransactionSnapshot {
  const isMonthlyExpense = isCurrentMonthExpense(transaction, now);
  const isDailyExpense = isRecentDailyExpense(transaction, now);

  return {
    ...snapshot,
    balance: isMonthlyExpense ? snapshot.balance - transaction.amount : snapshot.balance,
    categorySpending: isMonthlyExpense
      ? removeCategorySpending(snapshot.categorySpending, transaction)
      : snapshot.categorySpending,
    dailySpending: isDailyExpense
      ? removeDailySpending(snapshot.dailySpending, transaction)
      : snapshot.dailySpending,
  };
}

function removeDeletedCloudLedgerTransactionsFromSnapshot(
  snapshot: TransactionSnapshot,
  transactionIds: readonly TransactionId[],
  options: ApplyCloudLedgerTransactionsOptions,
  runtime: ApplyCloudLedgerTransactionsRuntime
): TransactionSnapshot {
  if (transactionIds.length === 0) return snapshot;

  const deletedIds = new Set(transactionIds);
  const removedTransactions = snapshot.pages.filter((transaction) =>
    deletedIds.has(transaction.id)
  );
  const aggregateTransactions = deletedAggregateTransactions({
    options,
    removedPageTransactions: removedTransactions,
    transactionIds,
  });
  const removedPageOffsetCount = removedTransactions.filter(
    runtime.isTransactionIncludedInPageOffset
  ).length;
  const snapshotWithoutPages: TransactionSnapshot = {
    ...snapshot,
    pages: snapshot.pages.filter((transaction) => !deletedIds.has(transaction.id)),
    offset: Math.max(0, snapshot.offset - removedPageOffsetCount),
  };

  return aggregateTransactions
    .filter((transaction) => options.isTransactionIncludedInAggregate?.(transaction) !== false)
    .reduce<TransactionSnapshot>(
      (currentSnapshot, transaction) =>
        removeCloudLedgerTransactionFromAggregates(currentSnapshot, transaction, runtime.now),
      snapshotWithoutPages
    );
}

export function loadRuntimeCloudLedgerTransactions(userId: UserId): readonly StoredTransaction[] {
  return getCloudLedgerRuntimeCache(userId).transactions.flatMap((transaction) =>
    cloudLedgerTransactionToStoredTransactions(userId, transaction)
  );
}

async function loadRestoredCloudLedgerPendingChanges(
  userId: UserId
): Promise<readonly CloudLedgerPendingChange[]> {
  return await getCloudLedgerOutbox(userId).load();
}

export async function loadRestoredCloudLedgerPendingTransactions(
  userId: UserId
): Promise<readonly StoredTransaction[]> {
  return (await loadRestoredCloudLedgerPendingChanges(userId)).flatMap((change) =>
    pendingCloudLedgerChangeToStoredTransactions(userId, change)
  );
}

export async function loadCloudLedgerOptimisticTransactions(
  userId: UserId
): Promise<readonly StoredTransaction[]> {
  return (await loadCloudLedgerOptimisticTransactionOverlay(userId)).transactions;
}

export async function loadCloudLedgerOptimisticTransactionOverlay(
  userId: UserId
): Promise<CloudLedgerOptimisticTransactionOverlay> {
  const runtimeTransactions = loadRuntimeCloudLedgerTransactions(userId);
  const restoredChanges = await loadRestoredCloudLedgerPendingChanges(userId);
  const restoredTransactions = restoredChanges.flatMap((change) =>
    pendingCloudLedgerChangeToStoredTransactions(userId, change)
  );
  return {
    deletedTransactionIds: restoredChanges.flatMap(pendingCloudLedgerChangeToDeletedTransactionIds),
    transactions: [
      ...runtimeTransactions,
      ...excludeTransactionsById(restoredTransactions, runtimeTransactions),
    ],
  };
}

function excludeTransactionsById(
  transactions: readonly StoredTransaction[],
  excludedTransactions: readonly StoredTransaction[]
): readonly StoredTransaction[] {
  const excludedIds = new Set(excludedTransactions.map((transaction) => transaction.id));
  return transactions.filter((transaction) => !excludedIds.has(transaction.id));
}

function applyCloudLedgerTransactionsToSnapshot(
  snapshot: TransactionSnapshot,
  transactions: readonly StoredTransaction[],
  options: ApplyCloudLedgerTransactionsOptions = {}
): TransactionSnapshot {
  const basePageIds = new Set(snapshot.pages.map((transaction) => transaction.id));
  const runtime = {
    aggregateReplacementTransactionIds: options.aggregateReplacementTransactionIds ?? new Set(),
    isTransactionIncludedInPageOffset:
      options.isTransactionIncludedInPageOffset ??
      ((transaction: StoredTransaction) => basePageIds.has(transaction.id)),
    now: new Date(),
  };
  return transactions.reduce(
    (currentSnapshot, transaction) =>
      addCloudLedgerTransactionToSnapshot(currentSnapshot, transaction, options, runtime),
    snapshot
  );
}

export function applyRuntimeCloudLedgerTransactions(
  snapshot: TransactionSnapshot,
  userId: UserId,
  options: ApplyCloudLedgerTransactionsOptions = {}
): TransactionSnapshot {
  return applyCloudLedgerTransactionsToSnapshot(
    snapshot,
    loadRuntimeCloudLedgerTransactions(userId),
    options
  );
}

export async function applyCloudLedgerOptimisticView(
  snapshot: TransactionSnapshot,
  userId: UserId,
  options: ApplyCloudLedgerTransactionsOptions = {}
): Promise<TransactionSnapshot> {
  const runtimeTransactions = loadRuntimeCloudLedgerTransactions(userId);
  const restoredChanges = await loadRestoredCloudLedgerPendingChanges(userId);
  const restoredDeletedTransactionIds = restoredChanges.flatMap(
    pendingCloudLedgerChangeToDeletedTransactionIds
  );
  const aggregateReplacementTransactionIds = new Set(
    restoredChanges.flatMap((change) =>
      change.kind === "amendTransaction" ? [change.transaction.id] : []
    )
  );
  const restoredTransactions = restoredChanges.flatMap((change) =>
    pendingCloudLedgerChangeToStoredTransactions(userId, change)
  );
  const runtimeSnapshot = applyCloudLedgerTransactionsToSnapshot(snapshot, runtimeTransactions, {
    ...options,
    aggregateReplacementTransactionIds,
  });
  const optimisticSnapshot = applyCloudLedgerTransactionsToSnapshot(
    runtimeSnapshot,
    excludeTransactionsById(restoredTransactions, runtimeTransactions),
    { ...options, aggregateReplacementTransactionIds }
  );
  const basePageIds = new Set(snapshot.pages.map((transaction) => transaction.id));
  return removeDeletedCloudLedgerTransactionsFromSnapshot(
    optimisticSnapshot,
    restoredDeletedTransactionIds,
    options,
    {
      aggregateReplacementTransactionIds,
      isTransactionIncludedInPageOffset:
        options.isTransactionIncludedInPageOffset ??
        ((transaction: StoredTransaction) => basePageIds.has(transaction.id)),
      now: new Date(),
    }
  );
}
