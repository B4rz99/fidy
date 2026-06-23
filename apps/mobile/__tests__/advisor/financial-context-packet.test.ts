import { describe, expect, it, vi } from "vitest";
import {
  createFinancialContextPacketBuilder,
  type FinancialContextPacketPorts,
} from "@/features/advisor/public";
import { requireMonth, requireUserId } from "@/shared/types/assertions";

const db = {} as never;
const userId = requireUserId("user-1");

function createPorts(): FinancialContextPacketPorts {
  return {
    getBalance: () => 1000000,
    getSpendingByCategory: (_db, _userId, month) =>
      month === "2026-04"
        ? [{ categoryId: "food", total: 120000 }]
        : [{ categoryId: "food", total: 90000 }],
    getRecentTransactions: () => [
      {
        type: "expense",
        amount: 120000,
        categoryId: "food",
        description: "Groceries",
        date: "2026-04-20",
      },
    ],
    getBudgetsForMonth: () => [
      { categoryId: "food", amount: 300000, month: requireMonth("2026-04") },
    ],
    getGoals: () => [
      { id: "goal-1", name: "Emergency fund", type: "savings", targetAmount: 1000000 },
    ],
    getGoalCurrentAmount: () => 250000,
    getAccounts: () => [{ name: "Cash", kind: "cash", isDefault: true }],
    getCaptureEvidence: () => [
      {
        scope: "merchant",
        value: "Market",
        sourceFamily: "email",
        evidenceType: "merchant",
        occurrences: 3,
      },
    ],
  };
}

describe("financial context packet", () => {
  it("builds task-scoped summaries and recent records from local ports", () => {
    const builder = createFinancialContextPacketBuilder(createPorts());

    expect(builder({ db, userId, now: new Date("2026-04-25T12:00:00.000Z") })).toMatchObject({
      summary: {
        balance: 1000000,
        currentMonthSpending: [{ categoryId: "food", total: 120000 }],
        previousMonthSpending: [{ categoryId: "food", total: 90000 }],
        monthOverMonthDeltas: [
          { categoryId: "food", current: 120000, previous: 90000, delta: 30000 },
        ],
      },
      recentTransactions: [
        {
          type: "expense",
          amount: 120000,
          categoryId: "food",
          description: "Groceries",
          date: "2026-04-20",
        },
      ],
      budgets: [{ categoryId: "food", amount: 300000, month: "2026-04" }],
      goals: [{ name: "Emergency fund", currentAmount: 250000, progressPct: 25 }],
      accounts: [{ name: "Cash" }],
      captureEvidence: [{ value: "Market", occurrences: 3 }],
    });
  });

  it("minimizes spending overview packets to only spending context", () => {
    const unrelatedPort = () => {
      throw new Error("unrelated port should not be called for spending overview packets");
    };
    const builder = createFinancialContextPacketBuilder({
      ...createPorts(),
      getGoals: unrelatedPort,
      getGoalCurrentAmount: unrelatedPort,
      getAccounts: unrelatedPort,
      getCaptureEvidence: unrelatedPort,
    });

    const packet = builder({
      db,
      userId,
      now: new Date("2026-04-25T12:00:00.000Z"),
      task: { kind: "spending_overview" },
    });

    expect(packet).toEqual({
      task: { kind: "spending_overview" },
      summary: {
        balance: 1000000,
        currentMonthSpending: [{ categoryId: "food", total: 120000 }],
        previousMonthSpending: [{ categoryId: "food", total: 90000 }],
        monthOverMonthDeltas: [
          { categoryId: "food", current: 120000, previous: 90000, delta: 30000 },
        ],
      },
      recentTransactions: [
        {
          type: "expense",
          amount: 120000,
          categoryId: "food",
          description: "Groceries",
          date: "2026-04-20",
        },
      ],
      budgets: [{ categoryId: "food", amount: 300000, month: "2026-04" }],
    });
    expect("accounts" in packet).toBe(false);
    expect("goals" in packet).toBe(false);
    expect("captureEvidence" in packet).toBe(false);
  });

  it("omits spending summaries from goal progress packets", () => {
    const unrelatedPort = vi.fn(() => {
      throw new Error("spending port should not be called for goal progress packets");
    });
    const builder = createFinancialContextPacketBuilder({
      ...createPorts(),
      getBalance: unrelatedPort,
      getSpendingByCategory: unrelatedPort,
      getRecentTransactions: unrelatedPort,
      getBudgetsForMonth: unrelatedPort,
      getAccounts: unrelatedPort,
      getCaptureEvidence: unrelatedPort,
    });

    const packet = builder({
      db,
      userId,
      now: new Date("2026-04-25T12:00:00.000Z"),
      task: { kind: "goal_progress" },
    });

    expect(packet).toEqual({
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
    expect(unrelatedPort).not.toHaveBeenCalled();
  });

  it("includes balance context in account overview packets", () => {
    const unrelatedPort = vi.fn(() => {
      throw new Error("unrelated port should not be called for account overview packets");
    });
    const builder = createFinancialContextPacketBuilder({
      ...createPorts(),
      getSpendingByCategory: unrelatedPort,
      getRecentTransactions: unrelatedPort,
      getBudgetsForMonth: unrelatedPort,
      getGoals: unrelatedPort,
      getGoalCurrentAmount: unrelatedPort,
      getCaptureEvidence: unrelatedPort,
    });

    const packet = builder({
      db,
      userId,
      now: new Date("2026-04-25T12:00:00.000Z"),
      task: { kind: "account_overview" },
    });

    expect(packet).toEqual({
      task: { kind: "account_overview" },
      summary: {
        balance: 1000000,
        currentMonthSpending: [],
        previousMonthSpending: [],
        monthOverMonthDeltas: [],
      },
      accounts: [{ name: "Cash", kind: "cash", isDefault: true }],
    });
    expect(unrelatedPort).not.toHaveBeenCalled();
  });
});
