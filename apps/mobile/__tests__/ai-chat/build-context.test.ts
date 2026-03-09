import { describe, expect, it } from "vitest";
import { buildChatContext } from "../../features/ai-chat/lib/build-context";
import type { UserMemory } from "../../features/ai-chat/schema";
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

const makeMemory = (overrides: Partial<UserMemory>): UserMemory => ({
  id: "mem_1",
  userId: "u1",
  fact: "Gets paid on the 15th",
  category: "habit",
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

describe("buildChatContext", () => {
  it("returns correctly shaped context with transactions and memories", () => {
    const txs = [
      makeTx({ type: "income", amountCents: 500000, date: new Date(2026, 2, 1) }),
      makeTx({ id: "tx_2", amountCents: 30000, categoryId: "food", date: new Date(2026, 2, 2) }),
      makeTx({
        id: "tx_3",
        amountCents: 15000,
        categoryId: "transport",
        date: new Date(2026, 2, 3),
      }),
      makeTx({ id: "tx_4", amountCents: 20000, categoryId: "food", date: new Date(2026, 1, 15) }),
    ];
    const memories = [makeMemory({})];

    const result = buildChatContext(txs, memories, "2026-03");

    expect(result.summary.balance).toBe(435000);
    expect(result.summary.currentMonthSpending).toEqual([
      { categoryId: "food", totalCents: 30000 },
      { categoryId: "transport", totalCents: 15000 },
    ]);
    expect(result.summary.previousMonthSpending).toEqual([
      { categoryId: "food", totalCents: 20000 },
    ]);
    expect(result.memories).toEqual([{ fact: "Gets paid on the 15th", category: "habit" }]);
    expect(result.transactions).toHaveLength(4);
  });

  it("handles empty transactions", () => {
    const result = buildChatContext([], [], "2026-03");

    expect(result.summary.balance).toBe(0);
    expect(result.summary.currentMonthSpending).toEqual([]);
    expect(result.summary.previousMonthSpending).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.memories).toEqual([]);
  });

  it("handles empty memories with transactions", () => {
    const txs = [makeTx({ amountCents: 5000 })];
    const result = buildChatContext(txs, [], "2026-03");

    expect(result.memories).toEqual([]);
    expect(result.transactions).toHaveLength(1);
  });

  it("filters transactions to current and previous month", () => {
    const txs = [
      makeTx({ date: new Date(2026, 2, 1) }), // March - current
      makeTx({ id: "tx_2", date: new Date(2026, 1, 15) }), // Feb - previous
      makeTx({ id: "tx_3", date: new Date(2026, 0, 10) }), // Jan - excluded
    ];
    const result = buildChatContext(txs, [], "2026-03");

    expect(result.transactions).toHaveLength(2);
  });

  it("maps transactions to context shape", () => {
    const txs = [
      makeTx({
        type: "expense",
        amountCents: 5000,
        categoryId: "food",
        description: "Lunch",
        date: new Date(2026, 2, 1),
      }),
    ];
    const result = buildChatContext(txs, [], "2026-03");

    expect(result.transactions[0]).toEqual({
      type: "expense",
      amountCents: 5000,
      categoryId: "food",
      description: "Lunch",
      date: "2026-03-01",
    });
  });
});
