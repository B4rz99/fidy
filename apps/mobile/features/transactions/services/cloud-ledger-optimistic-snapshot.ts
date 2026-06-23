import {
  type CloudLedgerPendingChange,
  type CloudLedgerTransaction,
  getCloudLedgerOutbox,
  getCloudLedgerRuntimeCache,
} from "@/features/cloud-ledger/public";
import { parseIsoDate, toIsoDate, toMonth } from "@/shared/lib";
import { requireCopAmount } from "@/shared/types/assertions";
import type { CopAmount, UserId } from "@/shared/types/branded";
import type { StoredTransaction } from "../schema";
import type {
  CategorySpendingItem,
  DailySpendingItem,
  TransactionAggregateSnapshot,
  TransactionPageSnapshot,
} from "./create-transaction-query-service";

type TransactionSnapshot = TransactionPageSnapshot & TransactionAggregateSnapshot;

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

function prependCloudLedgerTransaction(
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
      pages: [transaction, ...pagesWithoutTransaction],
      offset: snapshot.offset,
    },
    didInsert,
  };
}

function addCloudLedgerTransactionToSnapshot(
  snapshot: TransactionSnapshot,
  transaction: StoredTransaction,
  now: Date
): TransactionSnapshot {
  const cloudLedgerSnapshot = prependCloudLedgerTransaction(snapshot, transaction);
  if (!cloudLedgerSnapshot.didInsert) {
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

function toCloudLedgerStoredTransaction(
  userId: UserId,
  transaction: CloudLedgerTransaction
): readonly StoredTransaction[] {
  if (transaction.categoryId === null) {
    return [];
  }
  const updatedAt = new Date(transaction.updatedAt);
  return [
    {
      accountAttributionState: "confirmed",
      accountId: transaction.accountId,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      counterpartyName: "",
      createdAt: updatedAt,
      date: parseIsoDate(transaction.date),
      description: transaction.description ?? "",
      id: transaction.id,
      source: "manual",
      supersededAt: null,
      supersededByTransferId: null,
      type: transaction.type,
      updatedAt,
      userId,
      voidedAt: null,
    },
  ];
}

function toPendingStoredTransaction(
  userId: UserId,
  change: CloudLedgerPendingChange
): readonly StoredTransaction[] {
  if (change.kind !== "createTransaction" || change.transaction.categoryId === null) {
    return [];
  }
  const createdAt = new Date(change.createdAt);
  return [
    {
      accountAttributionState: "confirmed",
      accountId: change.transaction.accountId,
      amount: change.transaction.amount,
      categoryId: change.transaction.categoryId,
      counterpartyName: "",
      createdAt,
      date: parseIsoDate(change.transaction.date),
      description: change.transaction.description ?? "",
      id: change.transaction.id,
      source: "manual",
      supersededAt: null,
      supersededByTransferId: null,
      type: change.transaction.type,
      updatedAt: createdAt,
      userId,
      voidedAt: null,
    },
  ];
}

export function loadRuntimeCloudLedgerTransactions(userId: UserId): readonly StoredTransaction[] {
  return getCloudLedgerRuntimeCache(userId).transactions.flatMap((transaction) =>
    toCloudLedgerStoredTransaction(userId, transaction)
  );
}

export async function loadRestoredCloudLedgerPendingTransactions(
  userId: UserId
): Promise<readonly StoredTransaction[]> {
  return (await getCloudLedgerOutbox(userId).load()).flatMap((change) =>
    toPendingStoredTransaction(userId, change)
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
  transactions: readonly StoredTransaction[]
): TransactionSnapshot {
  const now = new Date();
  return transactions.reduce(
    (currentSnapshot, transaction) =>
      addCloudLedgerTransactionToSnapshot(currentSnapshot, transaction, now),
    snapshot
  );
}

export function applyRuntimeCloudLedgerTransactions(
  snapshot: TransactionSnapshot,
  userId: UserId
): TransactionSnapshot {
  return applyCloudLedgerTransactionsToSnapshot(
    snapshot,
    loadRuntimeCloudLedgerTransactions(userId)
  );
}

export async function applyCloudLedgerOptimisticView(
  snapshot: TransactionSnapshot,
  userId: UserId
): Promise<TransactionSnapshot> {
  return applyCloudLedgerTransactionsToSnapshot(
    snapshot,
    await loadCloudLedgerOptimisticTransactions(userId)
  );
}
