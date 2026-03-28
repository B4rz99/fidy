import { describe, expect, it } from "vitest";
import type {
  AccountId,
  CategoryId,
  CopAmount,
  IsoDate,
  Month,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  deriveBalance,
  deriveDailySpending,
  deriveSpendingByCategory,
} from "../../features/transactions/lib/derive";
import type { StoredTransaction } from "../../features/transactions/schema";

const NOW = new Date(2026, 2, 5, 12, 0, 0);

const makeTx = (overrides: Partial<StoredTransaction>): StoredTransaction => ({
  id: "tx_1" as TransactionId,
  userId: "u1" as UserId,
  type: "expense",
  amount: 1000 as CopAmount,
  categoryId: "food" as CategoryId,
  description: "test",
  date: new Date(2026, 2, 1),
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  accountId: "" as AccountId,
  linkedTransactionId: null,
  needsAccountReview: false,
  ...overrides,
});

describe("deriveBalance", () => {
  it("returns income minus expenses", () => {
    const txs = [
      makeTx({ type: "income", amount: 5000 as CopAmount }),
      makeTx({ id: "tx_2" as TransactionId, type: "expense", amount: 2000 as CopAmount }),
      makeTx({ id: "tx_3" as TransactionId, type: "expense", amount: 1000 as CopAmount }),
    ];
    expect(deriveBalance(txs)).toBe(2000);
  });

  it("returns 0 for empty array", () => {
    expect(deriveBalance([])).toBe(0);
  });
});

describe("deriveSpendingByCategory", () => {
  it("groups expenses by category for given month", () => {
    const txs = [
      makeTx({
        categoryId: "food" as CategoryId,
        amount: 1000 as CopAmount,
        date: new Date(2026, 2, 1),
      }),
      makeTx({
        id: "tx_2" as TransactionId,
        categoryId: "food" as CategoryId,
        amount: 2000 as CopAmount,
        date: new Date(2026, 2, 15),
      }),
      makeTx({
        id: "tx_3" as TransactionId,
        categoryId: "transport" as CategoryId,
        amount: 500 as CopAmount,
        date: new Date(2026, 2, 10),
      }),
      makeTx({
        id: "tx_4" as TransactionId,
        categoryId: "food" as CategoryId,
        amount: 999 as CopAmount,
        date: new Date(2026, 1, 28),
      }), // different month
      makeTx({
        id: "tx_5" as TransactionId,
        type: "income",
        amount: 9999 as CopAmount,
        date: new Date(2026, 2, 1),
      }), // income excluded
    ];
    const result = deriveSpendingByCategory(txs, "2026-03" as Month);
    expect(result).toEqual([
      { categoryId: "food", total: 3000 },
      { categoryId: "transport", total: 500 },
    ]);
  });

  it("returns empty array when no expenses in month", () => {
    const txs = [makeTx({ date: new Date(2026, 1, 1) })];
    expect(deriveSpendingByCategory(txs, "2026-03" as Month)).toEqual([]);
  });
});

describe("deriveDailySpending", () => {
  it("sums expenses per day within date range", () => {
    const txs = [
      makeTx({ amount: 1000 as CopAmount, date: new Date(2026, 2, 1) }),
      makeTx({ id: "tx_2" as TransactionId, amount: 500 as CopAmount, date: new Date(2026, 2, 1) }),
      makeTx({
        id: "tx_3" as TransactionId,
        amount: 2000 as CopAmount,
        date: new Date(2026, 2, 2),
      }),
      makeTx({
        id: "tx_4" as TransactionId,
        type: "income",
        amount: 9999 as CopAmount,
        date: new Date(2026, 2, 1),
      }), // excluded
    ];
    const result = deriveDailySpending(txs, "2026-03-01" as IsoDate, "2026-03-02" as IsoDate);
    expect(result).toEqual([
      { date: "2026-03-01", total: 1500 },
      { date: "2026-03-02", total: 2000 },
    ]);
  });

  it("returns empty array when no expenses in range", () => {
    expect(deriveDailySpending([], "2026-03-01" as IsoDate, "2026-03-31" as IsoDate)).toEqual([]);
  });
});
