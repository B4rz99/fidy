import { getCloudLedgerOutbox, getCloudLedgerRuntimeCache } from "@/features/cloud-ledger/public";
import { toIsoDate, toMonth } from "@/shared/lib";
import { requireCopAmount } from "@/shared/types/assertions";
import type { CopAmount, UserId } from "@/shared/types/branded";
import { upsertStoredTransactionByRepositoryOrder } from "../lib/transaction-order";
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
  transaction: StoredTransaction
): {
  readonly snapshot: TransactionSnapshot;
  readonly didInsert: boolean;
} {
  const pagesWithoutTransaction = snapshot.pages.filter((page) => page.id !== transaction.id);
  const didInsert = pagesWithoutTransaction.length === snapshot.pages.length;
  return {
    snapshot: {
      ...snapshot,
      pages: upsertStoredTransactionByRepositoryOrder(snapshot.pages, transaction),
      offset: snapshot.offset,
    },
    didInsert,
  };
}

function addCloudLedgerTransactionToSnapshot(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  now: Date,
  options: ApplyCloudLedgerTransactionsOptions
): TransactionSnapshot {
  const cloudLedgerSnapshot = upsertCloudLedgerTransaction(snapshot, transaction);
  if (
    !cloudLedgerSnapshot.didInsert ||
    options.isTransactionIncludedInAggregate?.(transaction) === true
  ) {
    return cloudLedgerSnapshot.snapshot;
  }
  const nextSnapshot = cloudLedgerSnapshot.snapshot;
  const isMonthlyExpense = isCurrentMonthExpense(transaction, now);
  const isDailyExpense = isRecentDailyExpense(transaction, now);

  return {
    ...nextSnapshot,
    balance: isMonthlyExpense ? nextSnapshot.balance + transaction.amount : nextSnapshot.balance,
    categorySpending: isMonthlyExpense
      ? upsertCategorySpending(nextSnapshot.categorySpending, transaction)
      : nextSnapshot.categorySpending,
    dailySpending: isDailyExpense
      ? upsertDailySpending(nextSnapshot.dailySpending, transaction)
      : nextSnapshot.dailySpending,
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
  return [
    ...loadRuntimeCloudLedgerTransactions(userId),
    ...(await loadRestoredCloudLedgerPendingTransactions(userId)),
  ];
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
  return applyCloudLedgerTransactionsToSnapshot(
    snapshot,
    await loadCloudLedgerOptimisticTransactions(userId),
    options
  );
}
