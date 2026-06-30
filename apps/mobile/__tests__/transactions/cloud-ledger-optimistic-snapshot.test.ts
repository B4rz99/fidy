import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  createEmptyCloudLedgerCache,
} from "@/features/cloud-ledger/public";
import {
  resetCloudLedgerRuntimeCaches,
  setCloudLedgerRuntimeCache,
} from "@/features/cloud-ledger/runtime.public";
import { applyRuntimeCloudLedgerTransactions } from "@/features/transactions/services/cloud-ledger-optimistic-snapshot";
import type { StoredTransaction } from "@/features/transactions/schema";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerCursor,
  requireTransactionId,
  requireUserId,
} from "@/shared/types/assertions";

const USER_ID = requireUserId("user-cloud-ledger-optimistic-snapshot");

beforeEach(() => {
  resetCloudLedgerRuntimeCaches();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-26T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  resetCloudLedgerRuntimeCaches();
});

describe("Cloud Ledger optimistic transaction snapshots", () => {
  it("keeps visible optimistic rows in aggregates when the DB aggregate does not include them", () => {
    const transaction = cloudLedgerStoredTransaction();
    setCloudLedgerRuntimeCache(
      USER_ID,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: requireLedgerCursor("ledger:9"),
        categories: [],
        financialAccounts: [],
        transactions: [
          {
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            currency: "COP",
            categoryId: transaction.categoryId,
            accountId: transaction.accountId,
            description: transaction.description,
            date: requireIsoDate("2026-06-02"),
            updatedAt: requireIsoDateTime("2026-06-02T10:04:00.000Z"),
            version: 1,
          },
        ],
        tombstones: [],
      })
    );

    const snapshot = applyRuntimeCloudLedgerTransactions(
      {
        balance: 0,
        categorySpending: [],
        dailySpending: [],
        hasMore: false,
        offset: 1,
        pages: [transaction],
      },
      USER_ID,
      {
        isTransactionIncludedInAggregate: () => false,
        pageWindowSize: 1,
      }
    );

    expect(snapshot.pages.map((page) => page.id)).toEqual([transaction.id]);
    expect(snapshot.balance).toBe(18_000);
    expect(snapshot.categorySpending).toEqual([
      { categoryId: requireCategoryId("cat-groceries"), total: requireCopAmount(18_000) },
    ]);
    expect(snapshot.dailySpending).toEqual([
      { date: requireIsoDate("2026-06-02"), total: requireCopAmount(18_000) },
    ]);
  });

  it("does not decrement committed offsets when a later overlay trims an optimistic row", () => {
    const committedTop = storedTransaction({
      createdAt: "2026-06-25T09:00:00.000Z",
      id: "txn-committed-top",
    });
    const committedTrimmed = storedTransaction({
      createdAt: "2026-06-24T09:00:00.000Z",
      id: "txn-committed-trimmed",
    });
    const optimisticMiddle = storedTransaction({
      createdAt: "2026-06-24T12:00:00.000Z",
      id: "txn-optimistic-middle",
    });
    const optimisticNewest = storedTransaction({
      createdAt: "2026-06-26T09:00:00.000Z",
      id: "txn-optimistic-newest",
    });
    setCloudLedgerRuntimeCache(
      USER_ID,
      applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: requireLedgerCursor("ledger:10"),
        categories: [],
        financialAccounts: [],
        transactions: [
          storedTransactionToCloudLedgerTransaction(optimisticMiddle),
          storedTransactionToCloudLedgerTransaction(optimisticNewest),
        ],
        tombstones: [],
      })
    );

    const snapshot = applyRuntimeCloudLedgerTransactions(
      {
        balance: 0,
        categorySpending: [],
        dailySpending: [],
        hasMore: true,
        offset: 2,
        pages: [committedTop, committedTrimmed],
      },
      USER_ID,
      {
        isTransactionIncludedInAggregate: (transaction) =>
          transaction.id === committedTop.id || transaction.id === committedTrimmed.id,
        pageWindowSize: 2,
      }
    );

    expect(snapshot.pages.map((page) => page.id)).toEqual([optimisticNewest.id, committedTop.id]);
    expect(snapshot.offset).toBe(1);
  });
});

function cloudLedgerStoredTransaction(): StoredTransaction {
  return storedTransaction({
    createdAt: "2026-06-02T10:04:00.000Z",
    id: "txn-cloud-ledger-visible",
  });
}

function storedTransaction({
  createdAt,
  id,
}: {
  readonly createdAt: string;
  readonly id: string;
}): StoredTransaction {
  const timestamp = new Date(createdAt);
  return {
    accountAttributionState: "confirmed",
    accountId: requireFinancialAccountId("acct-cash"),
    amount: requireCopAmount(18_000),
    categoryId: requireCategoryId("cat-groceries"),
    createdAt: timestamp,
    date: new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()),
    description: "Coffee",
    id: requireTransactionId(id),
    source: "cloud_ledger",
    type: "expense",
    updatedAt: timestamp,
    userId: USER_ID,
  };
}

function storedTransactionToCloudLedgerTransaction(transaction: StoredTransaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: "COP" as const,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    description: transaction.description,
    date: requireIsoDate(transaction.createdAt.toISOString().slice(0, 10)),
    updatedAt: requireIsoDateTime(transaction.updatedAt.toISOString()),
    version: 1,
  };
}
