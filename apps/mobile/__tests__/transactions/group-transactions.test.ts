import { describe, expect, it, vi } from "vitest";

vi.unmock("date-fns"); // setup.ts mocks date-fns; unmock to use real format()

import type { StoredTransaction } from "../../features/transactions/schema";
import { groupTransactionsByDate } from "../../features/transactions/lib/group-transactions";

const NOW = new Date(2026, 2, 13, 12, 0, 0); // March 13, 2026

const makeTx = (overrides: Partial<StoredTransaction>): StoredTransaction => ({
  id: "tx_1",
  userId: "u1",
  type: "expense",
  amountCents: 1000,
  categoryId: "food",
  description: "test",
  date: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  ...overrides,
});

describe("groupTransactionsByDate", () => {
  it("returns empty array for empty input", () => {
    expect(groupTransactionsByDate([], NOW)).toEqual([]);
  });

  it("wraps a single transaction with a date header", () => {
    const tx = makeTx({ date: new Date(2026, 2, 10) });
    const result = groupTransactionsByDate([tx], NOW);
    expect(result).toEqual([
      { type: "section-header", date: "2026-03-10", label: "Mar 10, 2026" },
      { type: "transaction", data: tx },
    ]);
  });

  it("labels today's transactions as 'Today'", () => {
    const tx = makeTx({ date: NOW });
    const result = groupTransactionsByDate([tx], NOW);
    expect(result[0]).toEqual({
      type: "section-header",
      date: "2026-03-13",
      label: "Today",
    });
  });

  it("labels yesterday's transactions as 'Yesterday'", () => {
    const yesterday = new Date(2026, 2, 12);
    const tx = makeTx({ date: yesterday });
    const result = groupTransactionsByDate([tx], NOW);
    expect(result[0]).toEqual({
      type: "section-header",
      date: "2026-03-12",
      label: "Yesterday",
    });
  });

  it("groups multiple transactions on same day under one header", () => {
    const date = new Date(2026, 2, 10);
    const tx1 = makeTx({ id: "tx_1", date });
    const tx2 = makeTx({ id: "tx_2", date });
    const result = groupTransactionsByDate([tx1, tx2], NOW);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty("type", "section-header");
    expect(result[1]).toEqual({ type: "transaction", data: tx1 });
    expect(result[2]).toEqual({ type: "transaction", data: tx2 });
  });

  it("produces separate headers for different days", () => {
    const tx1 = makeTx({ id: "tx_1", date: NOW });
    const tx2 = makeTx({ id: "tx_2", date: new Date(2026, 2, 10) });
    const result = groupTransactionsByDate([tx1, tx2], NOW);
    const headers = result.filter((item) => item.type === "section-header");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveProperty("label", "Today");
    expect(headers[1]).toHaveProperty("label", "Mar 10, 2026");
  });
});
