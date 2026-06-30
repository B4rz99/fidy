import * as SecureStore from "expo-secure-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCloudLedgerBootstrap,
  createEmptyCloudLedgerCache,
} from "@/features/cloud-ledger/public";
import {
  deleteOfflineCloudLedgerTransaction,
  getCloudLedgerOutbox,
  resetCloudLedgerOutboxInstances,
} from "@/features/cloud-ledger/outbox.public";
import {
  resetCloudLedgerRuntimeCaches,
  setCloudLedgerRuntimeCache,
} from "@/features/cloud-ledger/runtime.public";
import {
  applyCloudLedgerOptimisticView,
  applyRuntimeCloudLedgerTransactions,
} from "@/features/transactions/services/cloud-ledger-optimistic-snapshot";
import type { StoredTransaction } from "@/features/transactions/schema";
import {
  requireCategoryId,
  requireCopAmount,
  requireFinancialAccountId,
  requireIsoDate,
  requireIsoDateTime,
  requireLedgerChangeId,
  requireLedgerCursor,
  requireTransactionId,
  requireUserId,
} from "@/shared/types/assertions";

const USER_ID = requireUserId("user-cloud-ledger-optimistic-snapshot");
const secureStore = new Map<string, string>();

beforeEach(() => {
  secureStore.clear();
  resetCloudLedgerOutboxInstances();
  resetCloudLedgerRuntimeCaches();
  vi.mocked(SecureStore.getItem).mockImplementation((key: string) => secureStore.get(key) ?? null);
  vi.mocked(SecureStore.setItem).mockImplementation((key: string, value: string) => {
    secureStore.set(key, value);
  });
  vi.mocked(SecureStore.getItemAsync).mockImplementation((key: string) =>
    Promise.resolve(secureStore.get(key) ?? null)
  );
  vi.mocked(SecureStore.setItemAsync).mockImplementation((key: string, value: string) => {
    secureStore.set(key, value);
    return Promise.resolve();
  });
  vi.mocked(SecureStore.deleteItemAsync).mockImplementation((key: string) => {
    secureStore.delete(key);
    return Promise.resolve();
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-26T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  resetCloudLedgerOutboxInstances();
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

  it("hides base Cloud Ledger rows that have restored pending deletes", async () => {
    const transaction = cloudLedgerStoredTransaction();
    await deleteOfflineCloudLedgerTransaction({
      cache: applyCloudLedgerBootstrap(createEmptyCloudLedgerCache(), {
        cursor: requireLedgerCursor("ledger:9"),
        categories: [],
        financialAccounts: [],
        transactions: [storedTransactionToCloudLedgerTransaction(transaction)],
        tombstones: [],
      }),
      changeId: requireLedgerChangeId("change-delete-cloud-ledger-visible"),
      createdAt: requireIsoDateTime("2026-06-02T10:06:00.000Z"),
      expectedVersion: 1,
      outbox: getCloudLedgerOutbox(USER_ID),
      transactionId: transaction.id,
    });
    resetCloudLedgerOutboxInstances();

    const snapshot = await applyCloudLedgerOptimisticView(
      {
        balance: transaction.amount,
        categorySpending: [{ categoryId: transaction.categoryId, total: transaction.amount }],
        dailySpending: [
          {
            date: requireIsoDate("2026-06-02"),
            total: transaction.amount,
          },
        ],
        hasMore: false,
        offset: 1,
        pages: [transaction],
      },
      USER_ID,
      {
        isTransactionIncludedInAggregate: () => true,
        pageWindowSize: 1,
      }
    );

    expect(snapshot.pages).toEqual([]);
    expect(snapshot.offset).toBe(0);
    expect(snapshot.balance).toBe(0);
    expect(snapshot.categorySpending).toEqual([]);
    expect(snapshot.dailySpending).toEqual([]);
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
