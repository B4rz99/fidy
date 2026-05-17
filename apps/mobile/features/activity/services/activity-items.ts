import { toStoredTransaction } from "@/features/transactions/query.public";
import type { TransactionRow } from "@/features/transactions/query.public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { type StoredTransfer, toStoredTransfer } from "@/features/transfers/build.public";
import type { TransferRow } from "@/features/transfers/query.public";

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

type ActivityItemsInput = {
  readonly transactionRows: readonly TransactionRow[];
  readonly transferRows: readonly TransferRow[];
  readonly fetchSize: number;
};

function toTransactionActivityItem(row: TransactionRow): StoredActivityItem {
  const transaction = toStoredTransaction(row);
  return {
    kind: "transaction",
    id: transaction.id,
    date: transaction.date,
    updatedAt: transaction.updatedAt,
    transaction,
  };
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

export function toStoredActivityItems(input: ActivityItemsInput): readonly StoredActivityItem[] {
  const { transactionRows, transferRows, fetchSize } = input;
  return mergeActivityItems(
    transactionRows.slice(0, fetchSize).map(toTransactionActivityItem),
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
