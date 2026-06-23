import { getTransactionsPaginated } from "@/features/transactions/query.public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { getTransfersPaginated } from "@/features/transfers/query.public";
import type { AnyDb } from "@/shared/db/client";
import type { UserId } from "@/shared/types/branded";
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
  ) => Promise<readonly StoredTransaction[]>;
};
type LoadActivityPageRequest = LoadActivityPageInput & {
  readonly optimisticTransactions?: readonly StoredTransaction[];
  readonly transactionsLoader: typeof getTransactionsPaginated;
  readonly transfersLoader: typeof getTransfersPaginated;
};

function loadActivityPage(input: LoadActivityPageRequest): ActivityPageSnapshot {
  const fetchSize = input.offset + input.pageSize + 1;
  const mergedItems = toStoredActivityItems({
    optimisticTransactions: input.optimisticTransactions ?? [],
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

export function createActivityQueryService(deps: CreateActivityQueryServiceDeps = {}) {
  const {
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
        optimisticTransactions: await optimisticTransactionsLoader(input.userId),
        transactionsLoader,
        transfersLoader,
      }),
  };
}
