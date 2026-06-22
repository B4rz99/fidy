import { describe, expect, it } from "vitest";
import { readFinancialContextPacket } from "../../../../supabase/functions/ai-chat/financial-context-packet.ts";

const summary = {
  balance: 125000,
  currentMonthSpending: [{ categoryId: "food", total: 50000 }],
  previousMonthSpending: [],
  monthOverMonthDeltas: [{ categoryId: "food", current: 50000, previous: 0, delta: 50000 }],
};

describe("ai-chat financial context packet", () => {
  it("rejects packets containing sections outside the requested advisor task", () => {
    expect(
      readFinancialContextPacket({
        task: { kind: "goal_progress" },
        summary,
        goals: [
          {
            name: "Emergency fund",
            type: "savings",
            targetAmount: 1000000,
            currentAmount: 250000,
            progressPct: 25,
          },
        ],
        recentTransactions: [
          {
            type: "expense",
            amount: 50000,
            categoryId: "food",
            description: "Lunch",
            date: "2026-04-20",
          },
        ],
      })
    ).toBeNull();
  });

  it("sanitizes accepted packets to whitelisted fields", () => {
    const packet = readFinancialContextPacket({
      task: { kind: "spending_overview" },
      summary: {
        ...summary,
        ledgerDump: [{ id: "txn-secret" }],
        currentMonthSpending: [{ categoryId: "food", total: 50000, merchant: "Secret Shop" }],
      },
      recentTransactions: [
        {
          type: "expense",
          amount: 50000,
          categoryId: "food",
          description: "Lunch",
          date: "2026-04-20",
          authorizationNumber: "secret-auth",
        },
      ],
      budgets: [
        {
          categoryId: "food",
          amount: 200000,
          month: "2026-04",
          accountId: "account-secret",
        },
      ],
      ignoredTopLevel: "secret",
    });

    expect(packet).toEqual({
      task: { kind: "spending_overview" },
      summary,
      recentTransactions: [
        {
          type: "expense",
          amount: 50000,
          categoryId: "food",
          description: "Lunch",
          date: "2026-04-20",
        },
      ],
      budgets: [{ categoryId: "food", amount: 200000, month: "2026-04" }],
    });
    expect(JSON.stringify(packet)).not.toContain("secret");
  });

  it("rejects oversized allowed sections", () => {
    const recentTransactions = Array.from({ length: 21 }, (_, index) => ({
      type: "expense",
      amount: 50000 + index,
      categoryId: "food",
      description: `Lunch ${index}`,
      date: "2026-04-20",
    }));

    expect(
      readFinancialContextPacket({
        task: { kind: "spending_overview" },
        summary,
        recentTransactions,
      })
    ).toBeNull();
  });
});
