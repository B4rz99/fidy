import { toStoredTransaction } from "@/features/transactions/lib/build-transaction";
import { getTransactionsPaginated } from "@/features/transactions/lib/repository";
import type { StoredTransaction } from "@/features/transactions/schema";
import { type StoredTransfer, toStoredTransfer } from "@/features/transfers/lib/build-transfer";
import { getTransfersPaginated } from "@/features/transfers/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import type { UserId } from "@/shared/types/branded";

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

export type ActivityPageSnapshot = {
  readonly pages: readonly StoredActivityItem[];
  readonly offset: number;
  readonly hasMore: boolean;
};

type LoadActivityPageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly pageSize: number;
  readonly offset: number;
};

type CreateActivityQueryServiceDeps = {
  readonly getTransactionsPaginated?: typeof getTransactionsPaginated;
  readonly getTransfersPaginated?: typeof getTransfersPaginated;
};

function toStoredActivityItems(
  transactionRows: ReturnType<typeof getTransactionsPaginated>,
  transferRows: ReturnType<typeof getTransfersPaginated>,
  fetchSize: number
): readonly StoredActivityItem[] {
  const transactionItems = transactionRows.slice(0, fetchSize).map((row) => {
    const transaction = toStoredTransaction(row);
    return {
      kind: "transaction" as const,
      id: transaction.id,
      date: transaction.date,
      updatedAt: transaction.updatedAt,
      transaction,
    };
  });
  const transferItems = transferRows.slice(0, fetchSize).map((row) => {
    const transfer = toStoredTransfer(row);
    return {
      kind: "transfer" as const,
      id: transfer.id,
      date: transfer.date,
      updatedAt: transfer.updatedAt,
      transfer,
    };
  });

  return mergeActivityItems(transactionItems, transferItems);
}

function compareActivityItems(left: StoredActivityItem, right: StoredActivityItem) {
  const dateDiff = right.date.getTime() - left.date.getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function mergeActivityItems(
  left: readonly StoredActivityItem[],
  right: readonly StoredActivityItem[]
): readonly StoredActivityItem[] {
  if (left.length === 0) {
    return right;
  }

  if (right.length === 0) {
    return left;
  }

  const leftHead = left[0];
  const rightHead = right[0];

  if (leftHead == null || rightHead == null) {
    return [...left, ...right];
  }

  return compareActivityItems(leftHead, rightHead) <= 0
    ? [leftHead, ...mergeActivityItems(left.slice(1), right)]
    : [rightHead, ...mergeActivityItems(left, right.slice(1))];
}

export function createActivityQueryService({
  getTransactionsPaginated: loadTransactionsPaginated = getTransactionsPaginated,
  getTransfersPaginated: loadTransfersPaginated = getTransfersPaginated,
}: CreateActivityQueryServiceDeps = {}) {
  return {
    loadPage({ db, userId, pageSize, offset }: LoadActivityPageInput): ActivityPageSnapshot {
      const fetchSize = offset + pageSize + 1;
      const mergedItems = toStoredActivityItems(
        loadTransactionsPaginated(db, userId, fetchSize, 0),
        loadTransfersPaginated(db, userId, fetchSize, 0),
        fetchSize
      );
      const window = mergedItems.slice(offset, offset + pageSize + 1);
      const hasMore = window.length > pageSize;
      const pages = hasMore ? window.slice(0, pageSize) : window;

      return {
        pages,
        offset: offset + pages.length,
        hasMore,
      };
    },
  };
}
