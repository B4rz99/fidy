import { getTransactionsPaginated } from "@/features/transactions/query.public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { getTransfersPaginated } from "@/features/transfers/query.public";
import type { AnyDb } from "@/shared/db/client";
import { captureWarning } from "@/shared/lib";
import type { TransactionId, UserId } from "@/shared/types/branded";
import { type StoredActivityItem, toStoredActivityItems } from "./activity-items";

export type { StoredActivityItem } from "./activity-items";

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
  readonly loadCloudLedgerOptimisticTransactions?: (
    userId: UserId
  ) => Promise<CloudLedgerActivityOverlay | readonly StoredTransaction[]>;
  readonly captureWarning?: typeof captureWarning;
};
type CloudLedgerActivityOverlay = {
  readonly transactions: readonly StoredTransaction[];
  readonly deletedTransactionIds: readonly TransactionId[];
};
type LoadActivityPageRequest = LoadActivityPageInput & {
  readonly cloudLedgerOverlay?: CloudLedgerActivityOverlay;
  readonly transactionsLoader: typeof getTransactionsPaginated;
  readonly transfersLoader: typeof getTransfersPaginated;
};

function loadActivityPage(input: LoadActivityPageRequest): ActivityPageSnapshot {
  const fetchSize = input.offset + input.pageSize + 1;
  const mergedItems = toStoredActivityItems({
    deletedTransactionIds: input.cloudLedgerOverlay?.deletedTransactionIds,
    optimisticTransactions: input.cloudLedgerOverlay?.transactions,
    transactionRows: input.transactionsLoader({
      db: input.db,
      userId: input.userId,
      limit: fetchSize,
      offset: 0,
    }),
    transferRows: input.transfersLoader({
      db: input.db,
      userId: input.userId,
      limit: fetchSize,
      offset: 0,
    }),
    fetchSize,
  });
  const window = mergedItems.slice(input.offset, input.offset + input.pageSize + 1);
  const hasMore = window.length > input.pageSize;
  const pages = hasMore ? window.slice(0, input.pageSize) : window;

  return {
    pages,
    offset: input.offset + pages.length,
    hasMore,
  };
}

const getErrorType = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

function toCloudLedgerActivityOverlay(
  value: CloudLedgerActivityOverlay | readonly StoredTransaction[]
): CloudLedgerActivityOverlay {
  return isStoredTransactionArray(value)
    ? { transactions: value, deletedTransactionIds: [] }
    : value;
}

function isStoredTransactionArray(
  value: CloudLedgerActivityOverlay | readonly StoredTransaction[]
): value is readonly StoredTransaction[] {
  return Array.isArray(value);
}

async function loadOptimisticTransactions(input: {
  readonly captureWarning: typeof captureWarning;
  readonly optimisticTransactionsLoader: (
    userId: UserId
  ) => Promise<CloudLedgerActivityOverlay | readonly StoredTransaction[]>;
  readonly userId: UserId;
}): Promise<CloudLedgerActivityOverlay> {
  try {
    return toCloudLedgerActivityOverlay(await input.optimisticTransactionsLoader(input.userId));
  } catch (error) {
    input.captureWarning("cloud_ledger_home_activity_load_failed", {
      errorType: getErrorType(error),
    });
    return { transactions: [], deletedTransactionIds: [] };
  }
}

export function createActivityQueryService(deps: CreateActivityQueryServiceDeps = {}) {
  const {
    captureWarning: captureOptimisticLoadFailure = captureWarning,
    getTransactionsPaginated: transactionsLoader = getTransactionsPaginated,
    getTransfersPaginated: transfersLoader = getTransfersPaginated,
    loadCloudLedgerOptimisticTransactions: optimisticTransactionsLoader = async () => [],
  } = deps;

  return {
    loadPage: (input: LoadActivityPageInput) =>
      loadActivityPage({
        ...input,
        transactionsLoader,
        transfersLoader,
      }),
    loadPageWithCloudLedgerOptimisticView: async (input: LoadActivityPageInput) =>
      loadActivityPage({
        ...input,
        cloudLedgerOverlay: await loadOptimisticTransactions({
          captureWarning: captureOptimisticLoadFailure,
          optimisticTransactionsLoader,
          userId: input.userId,
        }),
        transactionsLoader,
        transfersLoader,
      }),
  };
}
