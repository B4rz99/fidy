import type { AnyDb } from "@/shared/db";
import { toIsoDate, toMonth } from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate, TransactionId, UserId } from "@/shared/types/branded";
import { toStoredTransaction } from "../lib/build-transaction";
import {
  getDailySpendingAggregate,
  getSpendingByCategoryAggregate,
  getTransactionById,
  getTransactionsPaginated,
} from "../lib/repository";
import type { StoredTransaction } from "../schema";

export type CategorySpendingItem = {
  readonly categoryId: CategoryId;
  readonly total: CopAmount;
};

export type DailySpendingItem = {
  readonly date: IsoDate;
  readonly total: CopAmount;
};

export type TransactionPageSnapshot = {
  readonly pages: readonly StoredTransaction[];
  readonly offset: number;
  readonly hasMore: boolean;
};

export type TransactionAggregateSnapshot = {
  readonly balance: number;
  readonly categorySpending: readonly CategorySpendingItem[];
  readonly dailySpending: readonly DailySpendingItem[];
};

export type TransactionRefreshSnapshot = TransactionPageSnapshot &
  TransactionAggregateSnapshot & {
    readonly sameData: boolean;
  };

type LoadPageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly pageSize: number;
  readonly offset: number;
};

type LoadInitialSnapshotInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly pageSize: number;
};

type LoadRefreshSnapshotInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly currentPages: readonly StoredTransaction[];
  readonly currentOffset: number;
  readonly pageSize: number;
};

type GetStoredTransactionInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transactionId: TransactionId;
};

type CreateTransactionQueryServiceDeps = {
  readonly getTransactionsPaginated?: typeof getTransactionsPaginated;
  readonly getSpendingByCategoryAggregate?: typeof getSpendingByCategoryAggregate;
  readonly getDailySpendingAggregate?: typeof getDailySpendingAggregate;
  readonly getTransactionById?: typeof getTransactionById;
  readonly getNow?: () => Date;
};

function toPageSnapshot(
  rows: ReturnType<typeof getTransactionsPaginated>,
  pageSize: number
): TransactionPageSnapshot {
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    pages: pageRows.map(toStoredTransaction),
    offset: pageRows.length,
    hasMore,
  };
}

function toPageKey(pages: readonly StoredTransaction[]): string {
  return pages.map((page) => `${page.id}:${page.updatedAt.getTime()}`).join(",");
}

function loadAggregateSnapshot(
  db: AnyDb,
  userId: UserId,
  getNow: () => Date,
  loadSpendingByCategory: typeof getSpendingByCategoryAggregate,
  loadDailySpending: typeof getDailySpendingAggregate
): TransactionAggregateSnapshot {
  const now = getNow();
  const currentMonth = toMonth(now);
  const inclusiveThirtyDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const startDate = toIsoDate(inclusiveThirtyDayStart);
  const endDate = toIsoDate(now);
  const categorySpending = loadSpendingByCategory(db, userId, currentMonth);
  const balance = categorySpending.reduce((sum, category) => sum + category.total, 0);
  const dailySpending = loadDailySpending(db, userId, startDate, endDate);

  return {
    balance,
    categorySpending,
    dailySpending,
  };
}

export function createTransactionQueryService({
  getTransactionsPaginated: loadTransactionsPaginated = getTransactionsPaginated,
  getSpendingByCategoryAggregate: loadSpendingByCategory = getSpendingByCategoryAggregate,
  getDailySpendingAggregate: loadDailySpending = getDailySpendingAggregate,
  getTransactionById: loadTransactionById = getTransactionById,
  getNow = () => new Date(),
}: CreateTransactionQueryServiceDeps = {}) {
  const loadAggregateOnlySnapshot = (db: AnyDb, userId: UserId): TransactionAggregateSnapshot =>
    loadAggregateSnapshot(db, userId, getNow, loadSpendingByCategory, loadDailySpending);

  return {
    loadInitialSnapshot({
      db,
      userId,
      pageSize,
    }: LoadInitialSnapshotInput): TransactionPageSnapshot & TransactionAggregateSnapshot {
      const pageSnapshot = toPageSnapshot(
        loadTransactionsPaginated(db, userId, pageSize, 0),
        pageSize
      );
      return {
        ...pageSnapshot,
        ...loadAggregateOnlySnapshot(db, userId),
      };
    },

    loadNextPage({ db, userId, pageSize, offset }: LoadPageInput): TransactionPageSnapshot {
      return toPageSnapshot(loadTransactionsPaginated(db, userId, pageSize, offset), pageSize);
    },

    loadRefreshSnapshot({
      db,
      userId,
      currentPages,
      currentOffset,
      pageSize,
    }: LoadRefreshSnapshotInput): TransactionRefreshSnapshot {
      const reloadSize = Math.max(currentOffset, pageSize);
      const pageSnapshot = toPageSnapshot(
        loadTransactionsPaginated(db, userId, reloadSize, 0),
        reloadSize
      );
      return {
        ...pageSnapshot,
        ...loadAggregateOnlySnapshot(db, userId),
        sameData: toPageKey(currentPages) === toPageKey(pageSnapshot.pages),
      };
    },

    loadAggregateSnapshot({
      db,
      userId,
    }: Pick<LoadInitialSnapshotInput, "db" | "userId">): TransactionAggregateSnapshot {
      return loadAggregateOnlySnapshot(db, userId);
    },

    getStoredTransaction({
      db,
      userId,
      transactionId,
    }: GetStoredTransactionInput): StoredTransaction | null {
      const row = loadTransactionById(db, transactionId);
      if (!row || row.userId !== userId || row.deletedAt != null) {
        return null;
      }
      return toStoredTransaction(row);
    },
  };
}
