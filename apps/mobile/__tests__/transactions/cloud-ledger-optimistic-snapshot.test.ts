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
});

function cloudLedgerStoredTransaction(): StoredTransaction {
  return {
    accountAttributionState: "confirmed",
    accountId: requireFinancialAccountId("acct-cash"),
    amount: requireCopAmount(18_000),
    categoryId: requireCategoryId("cat-groceries"),
    createdAt: new Date("2026-06-02T10:04:00.000Z"),
    date: new Date("2026-06-02T00:00:00.000Z"),
    description: "Coffee",
    id: requireTransactionId("txn-cloud-ledger-visible"),
    source: "cloud_ledger",
    type: "expense",
    updatedAt: new Date("2026-06-02T10:04:00.000Z"),
    userId: USER_ID,
  };
}
