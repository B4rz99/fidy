import { toStoredTransaction } from "@/features/transactions/query.public";
import type { TransactionRow } from "@/features/transactions/query.public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { type StoredTransfer, toStoredTransfer } from "@/features/transfers/build.public";
import type { TransferRow } from "@/features/transfers/query.public";
import type { TransactionId } from "@/shared/types/branded";

export type StoredActivityItem =
  | {
      readonly kind: "transaction";
      readonly id: StoredTransaction["id"];
      readonly date: Date;
      readonly updatedAt: Date;
      readonly transaction: StoredTransaction;
    }
  | {
      readonly kind: "transfer";
      readonly id: StoredTransfer["id"];
      readonly date: Date;
      readonly updatedAt: Date;
      readonly transfer: StoredTransfer;
    };
type TransactionActivityItem = Extract<StoredActivityItem, { kind: "transaction" }>;

type ActivityItemsInput = {
  readonly transactionRows: readonly TransactionRow[];
  readonly optimisticTransactions?: readonly StoredTransaction[];
  readonly deletedTransactionIds?: readonly TransactionId[];
  readonly transferRows: readonly TransferRow[];
  readonly fetchSize: number;
};

function toStoredTransactionActivityItem(transaction: StoredTransaction): TransactionActivityItem {
  return {
    kind: "transaction",
    id: transaction.id,
    date: transaction.date,
    updatedAt: transaction.updatedAt,
    transaction,
  };
}

function toTransactionRowActivityItem(row: TransactionRow): TransactionActivityItem {
  return toStoredTransactionActivityItem(toStoredTransaction(row));
}

function toTransferActivityItem(row: TransferRow): StoredActivityItem {
  const transfer = toStoredTransfer(row);
  return {
    kind: "transfer",
    id: transfer.id,
    date: transfer.date,
    updatedAt: transfer.updatedAt,
    transfer,
  };
}

function upsertTransactionActivityItems(
  localItems: readonly TransactionActivityItem[],
  optimisticItems: readonly TransactionActivityItem[]
): readonly TransactionActivityItem[] {
  return [...new Map([...localItems, ...optimisticItems].map((item) => [item.id, item])).values()];
}

function excludeDeletedTransactionActivityItems(
  items: readonly TransactionActivityItem[],
  deletedTransactionIds: readonly TransactionId[]
): readonly TransactionActivityItem[] {
  if (deletedTransactionIds.length === 0) return items;
  const deletedIds = new Set(deletedTransactionIds);
  return items.filter((item) => !deletedIds.has(item.id));
}

export function toStoredActivityItems(input: ActivityItemsInput): readonly StoredActivityItem[] {
  const {
    deletedTransactionIds = [],
    optimisticTransactions = [],
    transactionRows,
    transferRows,
    fetchSize,
  } = input;
  const transactionItems = upsertTransactionActivityItems(
    excludeDeletedTransactionActivityItems(
      transactionRows.slice(0, fetchSize).map(toTransactionRowActivityItem),
      deletedTransactionIds
    ),
    optimisticTransactions.map(toStoredTransactionActivityItem)
  );

  return mergeActivityItems(
    transactionItems,
    transferRows.slice(0, fetchSize).map(toTransferActivityItem)
  );
}

function getActivitySecondarySortTime(item: StoredActivityItem): number {
  return item.kind === "transaction"
    ? item.transaction.createdAt.getTime()
    : item.transfer.updatedAt.getTime();
}

function compareActivityItems(left: StoredActivityItem, right: StoredActivityItem) {
  const dateDiff = right.date.getTime() - left.date.getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }

  const secondaryDiff = getActivitySecondarySortTime(right) - getActivitySecondarySortTime(left);
  return secondaryDiff !== 0 ? secondaryDiff : right.id.localeCompare(left.id);
}

function mergeActivityItems(
  left: readonly StoredActivityItem[],
  right: readonly StoredActivityItem[]
): readonly StoredActivityItem[] {
  return [...left, ...right].sort(compareActivityItems);
}
