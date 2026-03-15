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
  it("converts cents to COP in summary", () => {
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

    const result = buildChatContext(
      txs,
      memories,
      "2026-03",
      435000, // balance in cents (500000 - 30000 - 15000 - 20000)
      [
        { categoryId: "food", totalCents: 30000 },
        { categoryId: "transport", totalCents: 15000 },
      ],
      [{ categoryId: "food", totalCents: 20000 }]
    );

    expect(result.summary.balance).toBe(4350);
    expect(result.summary.currentMonthSpending).toEqual([
      { categoryId: "food", total: 300 },
      { categoryId: "transport", total: 150 },
    ]);
    expect(result.summary.previousMonthSpending).toEqual([{ categoryId: "food", total: 200 }]);
    expect(result.memories).toEqual([{ fact: "Gets paid on the 15th", category: "habit" }]);
    expect(result.transactions).toHaveLength(4);
  });

  it("converts transaction amounts to COP", () => {
    const txs = [
      makeTx({
        type: "expense",
        amountCents: 5000,
        categoryId: "food",
        description: "Lunch",
        date: new Date(2026, 2, 1),
      }),
    ];
    const result = buildChatContext(
      txs,
      [],
      "2026-03",
      -5000,
      [{ categoryId: "food", totalCents: 5000 }],
      []
    );

    expect(result.transactions[0]).toEqual({
      type: "expense",
      amount: 50,
      categoryId: "food",
      description: "Lunch",
      date: "2026-03-01",
    });
  });

  it("computes month-over-month deltas", () => {
    const txs = [
      makeTx({ amountCents: 30000, categoryId: "food", date: new Date(2026, 2, 2) }),
      makeTx({
        id: "tx_2",
        amountCents: 15000,
        categoryId: "transport",
        date: new Date(2026, 2, 3),
      }),
      makeTx({ id: "tx_3", amountCents: 20000, categoryId: "food", date: new Date(2026, 1, 15) }),
      makeTx({
        id: "tx_4",
        amountCents: 10000,
        categoryId: "health",
        date: new Date(2026, 1, 10),
      }),
    ];

    const result = buildChatContext(
      txs,
      [],
      "2026-03",
      -75000,
      [
        { categoryId: "food", totalCents: 30000 },
        { categoryId: "transport", totalCents: 15000 },
      ],
      [
        { categoryId: "food", totalCents: 20000 },
        { categoryId: "health", totalCents: 10000 },
      ]
    );
    const deltas = result.summary.monthOverMonthDeltas;

    const foodDelta = deltas.find((d) => d.categoryId === "food");
    expect(foodDelta).toEqual({ categoryId: "food", current: 300, previous: 200, delta: 100 });

    const transportDelta = deltas.find((d) => d.categoryId === "transport");
    expect(transportDelta).toEqual({
      categoryId: "transport",
      current: 150,
      previous: 0,
      delta: 150,
    });

    const healthDelta = deltas.find((d) => d.categoryId === "health");
    expect(healthDelta).toEqual({ categoryId: "health", current: 0, previous: 100, delta: -100 });
  });

  it("handles empty transactions", () => {
    const result = buildChatContext([], [], "2026-03", 0, [], []);

    expect(result.summary.balance).toBe(0);
    expect(result.summary.currentMonthSpending).toEqual([]);
    expect(result.summary.previousMonthSpending).toEqual([]);
    expect(result.summary.monthOverMonthDeltas).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.memories).toEqual([]);
  });

  it("handles empty memories with transactions", () => {
    const txs = [makeTx({ amountCents: 5000 })];
    const result = buildChatContext(
      txs,
      [],
      "2026-03",
      -5000,
      [{ categoryId: "food", totalCents: 5000 }],
      []
    );

    expect(result.memories).toEqual([]);
    expect(result.transactions).toHaveLength(1);
  });

  it("passes through all provided transactions without filtering", () => {
    const txs = [
      makeTx({ date: new Date(2026, 2, 1) }), // March — current month
      makeTx({ id: "tx_2", date: new Date(2026, 1, 15) }), // Feb — previous month
      makeTx({ id: "tx_3", date: new Date(2025, 5, 10) }), // June 2025 — outside range
    ];
    const result = buildChatContext(txs, [], "2026-03", 0, [], []);

    expect(result.transactions).toHaveLength(3);
  });
});
