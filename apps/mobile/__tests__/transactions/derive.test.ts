import { describe, expect, it } from "vitest";
import {
  deriveBalance,
  deriveDailySpending,
  deriveSpendingByCategory,
} from "../../features/transactions/lib/derive";
import type { StoredTransaction } from "../../features/transactions/schema";

const NOW = new Date(2026, 2, 5, 12, 0, 0);

const makeTx = (overrides: Partial<StoredTransaction>): StoredTransaction => ({
  id: "tx_1",
  userId: "u1",
  type: "expense",
  amountCents: 1000,
  categoryId: "food",
  description: "test",
  date: new Date(2026, 2, 1),
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  ...overrides,
});

describe("deriveBalance", () => {
  it("returns income minus expenses in cents", () => {
    const txs = [
      makeTx({ type: "income", amountCents: 5000 }),
      makeTx({ id: "tx_2", type: "expense", amountCents: 2000 }),
      makeTx({ id: "tx_3", type: "expense", amountCents: 1000 }),
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
      makeTx({ categoryId: "food", amountCents: 1000, date: new Date(2026, 2, 1) }),
      makeTx({ id: "tx_2", categoryId: "food", amountCents: 2000, date: new Date(2026, 2, 15) }),
      makeTx({
        id: "tx_3",
        categoryId: "transport",
        amountCents: 500,
        date: new Date(2026, 2, 10),
      }),
      makeTx({ id: "tx_4", categoryId: "food", amountCents: 999, date: new Date(2026, 1, 28) }), // different month
      makeTx({ id: "tx_5", type: "income", amountCents: 9999, date: new Date(2026, 2, 1) }), // income excluded
    ];
    const result = deriveSpendingByCategory(txs, "2026-03");
    expect(result).toEqual([
      { categoryId: "food", totalCents: 3000 },
      { categoryId: "transport", totalCents: 500 },
    ]);
  });

  it("returns empty array when no expenses in month", () => {
    const txs = [makeTx({ date: new Date(2026, 1, 1) })];
    expect(deriveSpendingByCategory(txs, "2026-03")).toEqual([]);
  });
});

describe("deriveDailySpending", () => {
  it("sums expenses per day within date range", () => {
    const txs = [
      makeTx({ amountCents: 1000, date: new Date(2026, 2, 1) }),
      makeTx({ id: "tx_2", amountCents: 500, date: new Date(2026, 2, 1) }),
      makeTx({ id: "tx_3", amountCents: 2000, date: new Date(2026, 2, 2) }),
      makeTx({ id: "tx_4", type: "income", amountCents: 9999, date: new Date(2026, 2, 1) }), // excluded
    ];
    const result = deriveDailySpending(txs, "2026-03-01", "2026-03-02");
    expect(result).toEqual([
      { date: "2026-03-01", totalCents: 1500 },
      { date: "2026-03-02", totalCents: 2000 },
    ]);
  });

  it("returns empty array when no expenses in range", () => {
    expect(deriveDailySpending([], "2026-03-01", "2026-03-31")).toEqual([]);
  });
});
