import { describe, expect, it } from "vitest";
import { create } from "zustand";
import { createTransactionStoreState } from "@/features/transactions/store/state";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const DEFAULT_ACCOUNT_ID = "fa-default" as FinancialAccountId;

function makeStoredTransaction(overrides: Partial<{ id: TransactionId }> = {}) {
  return {
    id: "tx-1" as TransactionId,
    userId: "user-1" as UserId,
    type: "expense" as const,
    amount: 1000 as CopAmount,
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: new Date("2026-03-04T00:00:00.000Z"),
    createdAt: new Date("2026-03-04T10:00:00.000Z"),
    updatedAt: new Date("2026-03-04T10:00:00.000Z"),
    deletedAt: null,
    accountId: DEFAULT_ACCOUNT_ID,
    accountAttributionState: "confirmed" as const,
    ...overrides,
  };
}

describe("transaction store state helper", () => {
  it("adopts the latest default account only while the draft is still following defaults", () => {
    const store = create(createTransactionStoreState);

    store.getState().setDefaultAccountId(DEFAULT_ACCOUNT_ID);
    expect(store.getState().accountId).toBe(DEFAULT_ACCOUNT_ID);

    store.getState().setAccountId("fa-custom" as FinancialAccountId);
    store.getState().setDefaultAccountId("fa-next-default" as FinancialAccountId);

    expect(store.getState()).toMatchObject({
      defaultAccountId: "fa-next-default",
      accountId: "fa-custom",
    });
  });

  it("preserves current pages during same-data refreshes while bumping revision", () => {
    const store = create(createTransactionStoreState);
    const currentPage = makeStoredTransaction();

    store.setState({
      pages: [currentPage],
      offset: 1,
      hasMore: true,
      dataRevision: 4,
    });

    store.getState().applyRefreshSnapshot({
      pages: [makeStoredTransaction({ id: "tx-2" as TransactionId })],
      offset: 1,
      hasMore: false,
      balance: 1000,
      categorySpending: [{ categoryId: "food" as CategoryId, total: 1000 as CopAmount }],
      dailySpending: [{ date: "2026-03-04" as IsoDate, total: 1000 as CopAmount }],
      sameData: true,
    });

    expect(store.getState()).toMatchObject({
      pages: [currentPage],
      offset: 1,
      hasMore: false,
      dataRevision: 5,
    });
  });
});
