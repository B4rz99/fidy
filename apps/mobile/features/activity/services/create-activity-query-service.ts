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

  const leftSecondarySortTime =
    left.kind === "transaction"
      ? left.transaction.createdAt.getTime()
      : left.transfer.updatedAt.getTime();
  const rightSecondarySortTime =
    right.kind === "transaction"
      ? right.transaction.createdAt.getTime()
      : right.transfer.updatedAt.getTime();
  const secondaryDiff = rightSecondarySortTime - leftSecondarySortTime;

  if (secondaryDiff !== 0) {
    return secondaryDiff;
  }

  return right.id.localeCompare(left.id);
}

function mergeActivityItems(
  left: readonly StoredActivityItem[],
  right: readonly StoredActivityItem[]
): readonly StoredActivityItem[] {
  const merged: StoredActivityItem[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  // Keep pagination windows stack-safe even when the merged offset grows large.
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftHead = left[leftIndex];
    const rightHead = right[rightIndex];

    if (leftHead == null || rightHead == null) {
      break;
    }

    if (compareActivityItems(leftHead, rightHead) <= 0) {
      merged.push(leftHead);
      leftIndex += 1;
    } else {
      merged.push(rightHead);
      rightIndex += 1;
    }
  }

  return [...merged, ...left.slice(leftIndex), ...right.slice(rightIndex)];
}

export function createActivityQueryService({
  getTransactionsPaginated: loadTransactionsPaginated = getTransactionsPaginated,
  getTransfersPaginated: loadTransfersPaginated = getTransfersPaginated,
}: CreateActivityQueryServiceDeps = {}) {
  return {
    loadPage(input: LoadActivityPageInput): ActivityPageSnapshot {
      const { db, userId, pageSize, offset } = input;
      const fetchSize = offset + pageSize + 1;
      const mergedItems = toStoredActivityItems(
        loadTransactionsPaginated({
          db,
          userId,
          limit: fetchSize,
          offset: 0,
        }),
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
