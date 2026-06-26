import { getCloudLedgerOutbox } from "@/features/cloud-ledger/outbox.public";
import { getCloudLedgerRuntimeCache } from "@/features/cloud-ledger/runtime.public";
import { toIsoDate, toMonth } from "@/shared/lib";
import { requireCopAmount } from "@/shared/types/assertions";
import type { CopAmount, UserId } from "@/shared/types/branded";
import {
  compareStoredTransactionsByRepositoryOrder,
  upsertStoredTransactionByRepositoryOrder,
} from "../lib/transaction-order";
import type { StoredTransaction } from "../schema";
import {
  cloudLedgerTransactionToStoredTransactions,
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
  readonly isTransactionIncludedInAggregate?: (transaction: StoredTransaction) => boolean;
  readonly pageWindowSize?: number;
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

function upsertCloudLedgerTransaction(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  pageWindowSize?: number
): {
  readonly snapshot: TransactionSnapshot;
  readonly didExistInPages: boolean;
} {
  const didExistInPages = snapshot.pages.some((page) => page.id === transaction.id);
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
  const droppedCommittedPageCount = countDroppedCommittedPages(snapshot.pages, pages);

  return {
    snapshot: {
      ...snapshot,
      pages,
      offset: Math.max(0, snapshot.offset - droppedCommittedPageCount),
    },
    didExistInPages,
  };
}

const countDroppedCommittedPages = (
  before: readonly StoredTransaction[],
  after: readonly StoredTransaction[]
): number => {
  const afterIds = new Set(after.map((transaction) => transaction.id));
  return before.filter((transaction) => !afterIds.has(transaction.id)).length;
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

const trimPagesToWindow = (
  pages: readonly StoredTransaction[],
  pageWindowSize: number | undefined
): readonly StoredTransaction[] =>
  pageWindowSize == null ? pages : pages.slice(0, pageWindowSize);

function addCloudLedgerTransactionToSnapshot(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  now: Date,
  options: ApplyCloudLedgerTransactionsOptions
): TransactionSnapshot {
  const cloudLedgerSnapshot = upsertCloudLedgerTransaction(
    snapshot,
    transaction,
    options.pageWindowSize
  );
  return options.isTransactionIncludedInAggregate?.(transaction) === true
    ? cloudLedgerSnapshot.snapshot
    : addCloudLedgerTransactionToAggregates(cloudLedgerSnapshot.snapshot, transaction, now);
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

export function loadRuntimeCloudLedgerTransactions(userId: UserId): readonly StoredTransaction[] {
  return getCloudLedgerRuntimeCache(userId).transactions.flatMap((transaction) =>
    cloudLedgerTransactionToStoredTransactions(userId, transaction)
  );
}

export async function loadRestoredCloudLedgerPendingTransactions(
  userId: UserId
): Promise<readonly StoredTransaction[]> {
  return (await getCloudLedgerOutbox(userId).load()).flatMap((change) =>
    pendingCloudLedgerChangeToStoredTransactions(userId, change)
  );
}

export async function loadCloudLedgerOptimisticTransactions(
  userId: UserId
): Promise<readonly StoredTransaction[]> {
  const runtimeTransactions = loadRuntimeCloudLedgerTransactions(userId);
  return [
    ...runtimeTransactions,
    ...excludeTransactionsById(
      await loadRestoredCloudLedgerPendingTransactions(userId),
      runtimeTransactions
    ),
  ];
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
  const now = new Date();
  return transactions.reduce(
    (currentSnapshot, transaction) =>
      addCloudLedgerTransactionToSnapshot(currentSnapshot, transaction, now, options),
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
  const runtimeSnapshot = applyCloudLedgerTransactionsToSnapshot(
    snapshot,
    runtimeTransactions,
    options
  );
  return applyCloudLedgerTransactionsToSnapshot(
    runtimeSnapshot,
    excludeTransactionsById(
      await loadRestoredCloudLedgerPendingTransactions(userId),
      runtimeTransactions
    ),
    options
  );
}
