import { describe, expect, it } from "vitest";
import {
  inferFinancialContextPacketTaskFromMessages,
  readFinancialContextPacket,
} from "../../../../supabase/functions/ai-chat/financial-context-packet.ts";

const summary = {
  balance: 125000,
  currentMonthSpending: [{ categoryId: "food", total: 50000 }],
  previousMonthSpending: [],
  monthOverMonthDeltas: [{ categoryId: "food", current: 50000, previous: 0, delta: 50000 }],
};

function buildRecentTransactionFixture(index: number) {
  return {
    type: "expense",
    amount: 50000 + index,
    categoryId: "food",
    description: `Lunch ${index}`,
    date: "2026-04-20",
  };
}

function acceptsGoalProgressPacketWithoutSpendingSummary() {
  expect(
    readFinancialContextPacket(
      {
        task: { kind: "goal_progress" },
        goals: [
          {
            name: "Emergency fund",
            type: "savings",
            targetAmount: 1000000,
            currentAmount: 250000,
            progressPct: 25,
          },
        ],
      },
      "goal_progress"
    )
  ).toEqual({
    task: { kind: "goal_progress" },
    goals: [
      {
        name: "Emergency fund",
        type: "savings",
        targetAmount: 1000000,
        currentAmount: 250000,
        progressPct: 25,
      },
    ],
  });
}

function acceptsAccountOverviewPacketWithoutSpendingSummary() {
  expect(
    readFinancialContextPacket(
      {
        task: { kind: "account_overview" },
        accounts: [{ name: "Cash", kind: "cash", isDefault: true }],
      },
      "account_overview"
    )
  ).toEqual({
    task: { kind: "account_overview" },
    accounts: [{ name: "Cash", kind: "cash", isDefault: true }],
  });
}

function acceptsCaptureReviewPacketWithoutSpendingSummary() {
  expect(
    readFinancialContextPacket(
      {
        task: { kind: "capture_review" },
        captureEvidence: [
          {
            scope: "merchant",
            value: "Market",
            sourceFamily: "email",
            evidenceType: "merchant",
            occurrences: 3,
          },
        ],
      },
      "capture_review"
    )
  ).toEqual({
    task: { kind: "capture_review" },
    captureEvidence: [
      {
        scope: "merchant",
        value: "Market",
        sourceFamily: "email",
        evidenceType: "merchant",
        occurrences: 3,
      },
    ],
  });
}

describe("ai-chat financial context packet", () => {
  it("uses the server-inferred task to sanitize broad legacy packets", () => {
    const inferredTask = inferFinancialContextPacketTaskFromMessages([
      { role: "user", content: "How are my savings goals doing?" },
    ]);

    expect(inferredTask).toBe("goal_progress");
    expect(
      readFinancialContextPacket(
        {
          task: { kind: "general_advisor" },
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
          budgets: [{ categoryId: "food", amount: 200000, month: "2026-04" }],
          accounts: [{ name: "Cash", kind: "cash", isDefault: true }],
        },
        inferredTask
      )
    ).toEqual({
      task: { kind: "goal_progress" },
      goals: [
        {
          name: "Emergency fund",
          type: "savings",
          targetAmount: 1000000,
          currentAmount: 250000,
          progressPct: 25,
        },
      ],
    });
  });

  it("infers the packet task from the latest user message", () => {
    expect(
      inferFinancialContextPacketTaskFromMessages([
        { role: "user", content: "How are my goals doing?" },
        { role: "assistant", content: "Your goals are progressing." },
        { role: "user", content: "What did I spend this month?" },
      ])
    ).toBe("spending_overview");
  });

  it("ignores sections outside the requested advisor task", () => {
    expect(
      readFinancialContextPacket(
        {
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
        },
        "goal_progress"
      )
    ).toEqual({
      task: { kind: "goal_progress" },
      goals: [
        {
          name: "Emergency fund",
          type: "savings",
          targetAmount: 1000000,
          currentAmount: 250000,
          progressPct: 25,
        },
      ],
    });
  });

  it(
    "accepts goal progress packets without spending summary",
    acceptsGoalProgressPacketWithoutSpendingSummary
  );

  it(
    "accepts account overview packets without spending summary",
    acceptsAccountOverviewPacketWithoutSpendingSummary
  );

  it(
    "accepts capture review packets without spending summary",
    acceptsCaptureReviewPacketWithoutSpendingSummary
  );

  it("ignores spending summaries on non-spending task packets", () => {
    expect(
      readFinancialContextPacket(
        {
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
        },
        "goal_progress"
      )
    ).toEqual({
      task: { kind: "goal_progress" },
      goals: [
        {
          name: "Emergency fund",
          type: "savings",
          targetAmount: 1000000,
          currentAmount: 250000,
          progressPct: 25,
        },
      ],
    });
  });

  it("sanitizes accepted packets to whitelisted fields", () => {
    const packet = readFinancialContextPacket(
      {
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
      },
      "spending_overview"
    );

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

  it("truncates oversized allowed sections", () => {
    const recentTransactions = Array.from({ length: 21 }, (_, index) =>
      buildRecentTransactionFixture(index)
    );

    expect(
      readFinancialContextPacket(
        {
          task: { kind: "spending_overview" },
          summary,
          recentTransactions,
        },
        "spending_overview"
      )
    ).toEqual({
      task: { kind: "spending_overview" },
      summary,
      recentTransactions: recentTransactions.slice(0, 20),
    });
  });
});
