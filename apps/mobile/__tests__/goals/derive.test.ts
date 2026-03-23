import { describe, expect, it, vi } from "vitest";

// Restore real date-fns (global setup mocks it without addMonths)
vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return { ...actual };
});

// Freeze "today" so projected dates are deterministic
const FIXED_NOW = new Date("2026-03-19T12:00:00.000Z");
vi.useFakeTimers({ now: FIXED_NOW });

import {
  computeMedian,
  deriveBudgetNudges,
  deriveDebtProjection,
  deriveGoalAlerts,
  deriveGoalCardStatus,
  deriveGoalPaceGuidance,
  deriveGoalProgress,
  deriveGoalProjection,
  deriveInstallmentProgress,
  deriveMonthlyMilestones,
} from "@/features/goals/lib/derive";
import type { CopAmount } from "@/shared/types/branded";

// ---------------------------------------------------------------------------
// deriveGoalProgress
// ---------------------------------------------------------------------------

describe("deriveGoalProgress", () => {
  it("returns 0% with no contributions", () => {
    const result = deriveGoalProgress({ targetAmount: 1_000_000 }, 0);
    expect(result.percentComplete).toBe(0);
    expect(result.remaining).toBe(1_000_000);
    expect(result.isComplete).toBe(false);
  });

  it("returns 50% when half funded", () => {
    const result = deriveGoalProgress({ targetAmount: 1_000_000 }, 500_000);
    expect(result.percentComplete).toBe(50);
    expect(result.remaining).toBe(500_000);
    expect(result.isComplete).toBe(false);
  });

  it("returns 100% when exactly funded", () => {
    const result = deriveGoalProgress({ targetAmount: 1_000_000 }, 1_000_000);
    expect(result.percentComplete).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.isComplete).toBe(true);
  });

  it("allows percentComplete > 100 when over-funded", () => {
    const result = deriveGoalProgress({ targetAmount: 1_000_000 }, 1_200_000);
    expect(result.percentComplete).toBe(120);
    expect(result.remaining).toBe(-200_000);
    expect(result.isComplete).toBe(true);
  });

  it("handles zero target amount with no contributions (0%)", () => {
    const result = deriveGoalProgress({ targetAmount: 0 }, 0);
    expect(result.percentComplete).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.isComplete).toBe(true);
  });

  it("handles zero target amount with some amount (100%)", () => {
    const result = deriveGoalProgress({ targetAmount: 0 }, 500);
    expect(result.percentComplete).toBe(100);
    expect(result.remaining).toBe(-500);
    expect(result.isComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeMedian
// ---------------------------------------------------------------------------

describe("computeMedian", () => {
  it("returns 0 for empty array", () => {
    expect(computeMedian([])).toBe(0);
  });

  it("returns the single value for one-element array", () => {
    expect(computeMedian([42])).toBe(42);
  });

  it("returns average of two elements", () => {
    expect(computeMedian([10, 20])).toBe(15);
  });

  it("returns middle value for odd-length array", () => {
    expect(computeMedian([3, 1, 2])).toBe(2);
  });

  it("returns average of two middle values for even-length array", () => {
    expect(computeMedian([4, 1, 3, 2])).toBe(2.5);
  });

  it("handles unsorted input", () => {
    expect(computeMedian([100, 5, 50, 25, 75])).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// deriveGoalProjection
// ---------------------------------------------------------------------------

describe("deriveGoalProjection", () => {
  const makeMonthlyTotal = (month: string, type: string, total: number) => ({
    month,
    type,
    total,
  });

  it("returns confidence 'none' and null projection with 0 months data", () => {
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, []);
    expect(result.confidence).toBe("none");
    expect(result.projectedDate).toBeNull();
    expect(result.monthsToGo).toBeNull();
    expect(result.netMonthlySavings).toBe(0);
  });

  it("returns confidence 'low' with 1 month of data", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 3_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
    ];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    expect(result.confidence).toBe("low");
    expect(result.netMonthlySavings).toBe(1_000_000);
    expect(result.monthsToGo).toBe(5);
    expect(result.projectedDate).not.toBeNull();
  });

  it("returns confidence 'medium' with 2 months of data", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 3_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
      makeMonthlyTotal("2026-02", "income", 3_500_000),
      makeMonthlyTotal("2026-02", "expense", 2_200_000),
    ];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    expect(result.confidence).toBe("medium");
  });

  it("returns confidence 'high' with 3+ months of data", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 3_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
      makeMonthlyTotal("2026-02", "income", 3_500_000),
      makeMonthlyTotal("2026-02", "expense", 2_200_000),
      makeMonthlyTotal("2026-03", "income", 3_200_000),
      makeMonthlyTotal("2026-03", "expense", 2_100_000),
    ];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    expect(result.confidence).toBe("high");
  });

  it("returns null projection when savings rate is negative", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 1_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
    ];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    expect(result.netMonthlySavings).toBe(-1_000_000);
    expect(result.monthsToGo).toBeNull();
    expect(result.projectedDate).toBeNull();
  });

  it("returns monthsToGo=0 when goal is already complete", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 3_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
    ];
    const result = deriveGoalProjection(
      { targetAmount: 5_000_000, type: "savings" },
      5_000_000,
      totals
    );
    expect(result.monthsToGo).toBe(0);
    expect(result.projectedDate).toEqual(FIXED_NOW);
  });

  it("returns monthsToGo=0 when over-funded", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 3_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
    ];
    const result = deriveGoalProjection(
      { targetAmount: 5_000_000, type: "savings" },
      6_000_000,
      totals
    );
    expect(result.monthsToGo).toBe(0);
  });

  it("computes median correctly with 3 data points", () => {
    // incomes: 2M, 3M, 4M → median 3M
    // expenses: 1M, 1.5M, 2M → median 1.5M
    // net = 1.5M, remaining = 5M, monthsToGo = ceil(5/1.5) = 4
    const totals = [
      makeMonthlyTotal("2026-01", "income", 2_000_000),
      makeMonthlyTotal("2026-01", "expense", 1_000_000),
      makeMonthlyTotal("2026-02", "income", 4_000_000),
      makeMonthlyTotal("2026-02", "expense", 2_000_000),
      makeMonthlyTotal("2026-03", "income", 3_000_000),
      makeMonthlyTotal("2026-03", "expense", 1_500_000),
    ];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    expect(result.netMonthlySavings).toBe(1_500_000);
    expect(result.monthsToGo).toBe(4);
  });

  it("returns null projection when savings are exactly zero", () => {
    const totals = [
      makeMonthlyTotal("2026-01", "income", 2_000_000),
      makeMonthlyTotal("2026-01", "expense", 2_000_000),
    ];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    expect(result.netMonthlySavings).toBe(0);
    expect(result.monthsToGo).toBeNull();
    expect(result.projectedDate).toBeNull();
  });

  it("handles months with only income (no expense row)", () => {
    const totals = [makeMonthlyTotal("2026-01", "income", 3_000_000)];
    const result = deriveGoalProjection({ targetAmount: 6_000_000, type: "savings" }, 0, totals);
    // expense median = 0, net = 3M, monthsToGo = 2
    expect(result.netMonthlySavings).toBe(3_000_000);
    expect(result.monthsToGo).toBe(2);
  });

  it("handles months with only expense (no income row)", () => {
    const totals = [makeMonthlyTotal("2026-01", "expense", 2_000_000)];
    const result = deriveGoalProjection({ targetAmount: 5_000_000, type: "savings" }, 0, totals);
    // income median = 0, net = -2M
    expect(result.netMonthlySavings).toBe(-2_000_000);
    expect(result.monthsToGo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deriveDebtProjection
// ---------------------------------------------------------------------------

describe("deriveDebtProjection", () => {
  it("calculates normal debt with interest", () => {
    // 10% annual interest, 1M remaining, 100k monthly payment
    const result = deriveDebtProjection(
      { targetAmount: 1_000_000, interestRatePercent: 10 },
      0,
      100_000
    );
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.monthsToGo).toBeGreaterThan(0);
      expect(result.projectedDate).toBeInstanceOf(Date);
      // Verify no NaN/Infinity
      expect(Number.isFinite(result.monthsToGo)).toBe(true);
    }
  });

  it("returns 'zero_rate' for zero interest rate", () => {
    // 0% interest, 1M remaining, 200k/month → 5 months
    const result = deriveDebtProjection(
      { targetAmount: 1_000_000, interestRatePercent: 0 },
      0,
      200_000
    );
    expect(result.status).toBe("zero_rate");
    if (result.status === "zero_rate") {
      expect(result.monthsToGo).toBe(5);
      expect(result.projectedDate).toBeInstanceOf(Date);
    }
  });

  it("returns 'zero_rate' for null interest rate", () => {
    const result = deriveDebtProjection(
      { targetAmount: 1_000_000, interestRatePercent: null },
      0,
      200_000
    );
    expect(result.status).toBe("zero_rate");
    if (result.status === "zero_rate") {
      expect(result.monthsToGo).toBe(5);
    }
  });

  it("returns 'payment_too_low' when payment cannot cover interest", () => {
    // 12% annual on 10M → monthly interest = 100,000
    // Payment of 50,000 < 100,000 → never pays off
    const result = deriveDebtProjection(
      { targetAmount: 10_000_000, interestRatePercent: 12 },
      0,
      50_000
    );
    expect(result.status).toBe("payment_too_low");
  });

  it("returns 'payment_too_low' when payment equals interest exactly", () => {
    // 12% annual on 10M → monthly interest = 100,000
    const result = deriveDebtProjection(
      { targetAmount: 10_000_000, interestRatePercent: 12 },
      0,
      100_000
    );
    expect(result.status).toBe("payment_too_low");
  });

  it("returns 'complete' when already paid off", () => {
    const result = deriveDebtProjection(
      { targetAmount: 1_000_000, interestRatePercent: 10 },
      1_000_000,
      100_000
    );
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.monthsToGo).toBe(0);
    }
  });

  it("returns 'complete' when over-paid", () => {
    const result = deriveDebtProjection(
      { targetAmount: 1_000_000, interestRatePercent: 10 },
      1_500_000,
      100_000
    );
    expect(result.status).toBe("complete");
  });

  it("never returns NaN in monthsToGo", () => {
    const scenarios = [
      { target: 0, interest: 0, current: 0, payment: 0 },
      { target: 1_000_000, interest: 10, current: 0, payment: 1 },
      { target: 1, interest: 0.01, current: 0, payment: 1_000_000 },
    ];
    scenarios.forEach(({ target, interest, current, payment }) => {
      const result = deriveDebtProjection(
        { targetAmount: target, interestRatePercent: interest },
        current,
        payment
      );
      if ("monthsToGo" in result) {
        expect(Number.isNaN(result.monthsToGo)).toBe(false);
        expect(Number.isFinite(result.monthsToGo)).toBe(true);
      }
    });
  });

  it("handles zero monthly payment on zero-rate debt", () => {
    const result = deriveDebtProjection({ targetAmount: 1_000_000, interestRatePercent: 0 }, 0, 0);
    expect(result.status).toBe("payment_too_low");
  });
});

// ---------------------------------------------------------------------------
// deriveMonthlyMilestones
// ---------------------------------------------------------------------------

describe("deriveMonthlyMilestones", () => {
  it("generates correct number of milestones", () => {
    const result = deriveMonthlyMilestones(0, 100_000, 5);
    expect(result).toHaveLength(5);
  });

  it("generates correct cumulative targets", () => {
    const result = deriveMonthlyMilestones(500_000, 100_000, 3);
    expect(result[0].cumulativeTarget).toBe(600_000);
    expect(result[1].cumulativeTarget).toBe(700_000);
    expect(result[2].cumulativeTarget).toBe(800_000);
  });

  it("returns empty array when monthsToGo is 0", () => {
    const result = deriveMonthlyMilestones(1_000_000, 100_000, 0);
    expect(result).toHaveLength(0);
  });

  it("sets isCompleted to false for all milestones", () => {
    const result = deriveMonthlyMilestones(0, 100_000, 3);
    for (const m of result) {
      expect(m.isCompleted).toBe(false);
    }
  });

  it("generates sequential month dates", () => {
    const result = deriveMonthlyMilestones(0, 100_000, 3);
    // From FIXED_NOW (2026-03-19), months should be Apr, May, Jun 2026
    expect(result[0].month.getMonth()).toBe(3); // April (0-indexed)
    expect(result[1].month.getMonth()).toBe(4); // May
    expect(result[2].month.getMonth()).toBe(5); // June
  });
});

// ---------------------------------------------------------------------------
// deriveInstallmentProgress
// ---------------------------------------------------------------------------

describe("deriveInstallmentProgress", () => {
  it("calculates total installments correctly", () => {
    const result = deriveInstallmentProgress(5_000_000, 1_000_000, 2);
    expect(result.total).toBe(5);
    expect(result.current).toBe(2);
  });

  it("returns total=0 when net savings is zero", () => {
    const result = deriveInstallmentProgress(5_000_000, 0, 3);
    expect(result.total).toBe(0);
    expect(result.current).toBe(3);
  });

  it("returns total=0 when net savings is negative", () => {
    const result = deriveInstallmentProgress(5_000_000, -500_000, 1);
    expect(result.total).toBe(0);
    expect(result.current).toBe(1);
  });

  it("rounds total up (ceil)", () => {
    // 5M / 1.5M = 3.33... → ceil = 4
    const result = deriveInstallmentProgress(5_000_000, 1_500_000, 0);
    expect(result.total).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// deriveBudgetNudges
// ---------------------------------------------------------------------------

describe("deriveBudgetNudges", () => {
  const spending = [
    { categoryId: "food", total: 800_000 },
    { categoryId: "transport", total: 400_000 },
    { categoryId: "entertainment", total: 600_000 },
    { categoryId: "utilities", total: 200_000 },
  ];

  it("returns top 3 categories by total spending", () => {
    const result = deriveBudgetNudges(0, 5_000_000, 500_000, spending);
    expect(result).toHaveLength(3);
    expect(result[0].categoryId).toBe("food");
  });

  it("calculates 15% reduction for each category", () => {
    const result = deriveBudgetNudges(0, 5_000_000, 500_000, spending);
    const foodNudge = result.find((n) => n.categoryId === "food");
    expect(foodNudge).toBeDefined();
    expect(foodNudge?.currentSpending).toBe(800_000);
    expect(foodNudge?.suggestedReduction).toBe(120_000); // 15% of 800k
  });

  it("calculates months saved correctly", () => {
    // remaining = 5M - 0 = 5M
    // baseline monthsToGo = 5M / 500k = 10
    // food reduction = 120k → new savings = 620k → 5M/620k = 8.06.. → ceil 9
    // monthsSaved = 10 - 9 = 1
    const result = deriveBudgetNudges(0, 5_000_000, 500_000, spending);
    const foodNudge = result.find((n) => n.categoryId === "food");
    expect(foodNudge).toBeDefined();
    expect(foodNudge?.monthsSaved).toBe(1);
  });

  it("sorts by monthsSaved descending", () => {
    const result = deriveBudgetNudges(0, 5_000_000, 500_000, spending);
    const monthsSaved = result.map((n) => n.monthsSaved);
    expect(monthsSaved).toEqual([...monthsSaved].sort((a, b) => b - a));
  });

  it("returns empty array when savings rate is zero", () => {
    const result = deriveBudgetNudges(0, 5_000_000, 0, spending);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when savings rate is negative", () => {
    const result = deriveBudgetNudges(0, 5_000_000, -100_000, spending);
    expect(result).toHaveLength(0);
  });

  it("handles fewer than 3 categories", () => {
    const smallSpending = [{ categoryId: "food", total: 800_000 }];
    const result = deriveBudgetNudges(0, 5_000_000, 500_000, smallSpending);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// deriveGoalAlerts
// ---------------------------------------------------------------------------

describe("deriveGoalAlerts", () => {
  it("generates alert when shift >= 1 month (delayed)", () => {
    const goals = [{ id: "g1", name: "Trip", currentMonthsToGo: 8 }];
    const previous = new Map([["g1", 6]]);
    const result = deriveGoalAlerts(goals, previous);
    expect(result).toHaveLength(1);
    expect(result[0].goalId).toBe("g1");
    expect(result[0].goalName).toBe("Trip");
    expect(result[0].shiftMonths).toBe(2); // delayed by 2 months
  });

  it("generates alert when shift >= 1 month (ahead of schedule)", () => {
    const goals = [{ id: "g1", name: "Car", currentMonthsToGo: 4 }];
    const previous = new Map([["g1", 6]]);
    const result = deriveGoalAlerts(goals, previous);
    expect(result).toHaveLength(1);
    expect(result[0].shiftMonths).toBe(-2); // 2 months ahead
  });

  it("does not generate alert when shift < 1 month", () => {
    const goals = [{ id: "g1", name: "Car", currentMonthsToGo: 6 }];
    const previous = new Map([["g1", 6]]);
    const result = deriveGoalAlerts(goals, previous);
    expect(result).toHaveLength(0);
  });

  it("does not generate alert when previous projection is missing", () => {
    const goals = [{ id: "g1", name: "Car", currentMonthsToGo: 6 }];
    const previous = new Map<string, number>();
    const result = deriveGoalAlerts(goals, previous);
    expect(result).toHaveLength(0);
  });

  it("does not generate alert when currentMonthsToGo is null", () => {
    const goals = [{ id: "g1", name: "Car", currentMonthsToGo: null }];
    const previous = new Map([["g1", 6]]);
    const result = deriveGoalAlerts(goals, previous);
    expect(result).toHaveLength(0);
  });

  it("handles multiple goals with mixed alert conditions", () => {
    const goals = [
      { id: "g1", name: "Trip", currentMonthsToGo: 8 }, // shifted +2
      { id: "g2", name: "Car", currentMonthsToGo: 5 }, // no shift
      { id: "g3", name: "House", currentMonthsToGo: 10 }, // shifted -3
    ];
    const previous = new Map([
      ["g1", 6],
      ["g2", 5],
      ["g3", 13],
    ]);
    const result = deriveGoalAlerts(goals, previous);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.goalId === "g1")?.shiftMonths).toBe(2);
    expect(result.find((a) => a.goalId === "g3")?.shiftMonths).toBe(-3);
  });
});

// ---------------------------------------------------------------------------
// deriveGoalPaceGuidance
// ---------------------------------------------------------------------------

describe("deriveGoalPaceGuidance", () => {
  it("returns null when goal is complete (currentAmount >= targetAmount)", () => {
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2027-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 1_000_000, true, FIXED_NOW);
    expect(result).toBeNull();
  });

  it("returns null when targetDate is null", () => {
    const goal = {
      targetAmount: 1_000_000,
      targetDate: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 0, true, FIXED_NOW);
    expect(result).toBeNull();
  });

  it("returns pace_behind with reason 'no_contributions' when hasContributions is false", () => {
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2027-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 0, false, FIXED_NOW);
    expect(result).toEqual({ type: "pace_behind", amountBehind: 0, reason: "no_contributions" });
  });

  it("returns pace_ahead with amountAhead 0 when exactly on pace (midpoint)", () => {
    // FIXED_NOW = 2026-03-19 (today)
    // createdAt 2025-03-19 (1 year ago), targetDate 2027-03-19 (1 year from now)
    // totalDays = 730, elapsedDays = 365, ratio = 0.5, expected = 1_000_000
    const goal = {
      targetAmount: 2_000_000,
      targetDate: "2027-03-19",
      createdAt: "2025-03-19T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 1_000_000, true, FIXED_NOW);
    expect(result).toEqual({ type: "pace_ahead", amountAhead: 0 });
  });

  it("returns pace_ahead with correct amountAhead when ahead of pace", () => {
    // createdAt 2025-03-19, targetDate 2027-03-19, FIXED_NOW 2026-03-19
    // totalDays = 730, elapsedDays = 365, expected = 500_000
    // currentAmount = 750_000 → 250_000 ahead
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2027-03-19",
      createdAt: "2025-03-19T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 750_000, true, FIXED_NOW);
    expect(result).toEqual({ type: "pace_ahead", amountAhead: 250_000 });
  });

  it("returns pace_behind with correct amountBehind and reason 'below_pace' when behind pace", () => {
    // createdAt 2025-03-19, targetDate 2027-03-19, FIXED_NOW 2026-03-19
    // expected = 500_000, currentAmount = 250_000 → 250_000 behind
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2027-03-19",
      createdAt: "2025-03-19T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 250_000, true, FIXED_NOW);
    expect(result).toEqual({ type: "pace_behind", amountBehind: 250_000, reason: "below_pace" });
  });

  it("returns pace_behind when today is past target date and goal not complete", () => {
    // targetDate in the past → elapsedDays clamped to totalDays → expectedNow = targetAmount
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2025-01-01",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 500_000, true, FIXED_NOW);
    expect(result).toEqual({ type: "pace_behind", amountBehind: 500_000, reason: "below_pace" });
  });

  it("returns null when totalDays <= 0 (createdAt === targetDate)", () => {
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2025-03-19",
      createdAt: "2025-03-19T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 0, true, FIXED_NOW);
    expect(result).toBeNull();
  });

  it("rounds fractional delta to a whole integer (COP has no cents)", () => {
    // createdAt 2025-03-19, targetDate 2027-03-19, FIXED_NOW 2026-03-19
    // totalDays = 730, elapsedDays = 365, ratio = 0.5
    // expected = 1_000_001 * 0.5 = 500_000.5, delta = 0 - 500_000.5 = -500_000.5
    // amountBehind = Math.round(500_000.5) = 500_001
    const goal = {
      targetAmount: 1_000_001,
      targetDate: "2027-03-19",
      createdAt: "2025-03-19T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 0, true, FIXED_NOW);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("pace_behind");
    if (result?.type === "pace_behind") {
      expect(result.reason).toBe("below_pace");
      expect(Number.isInteger(result.amountBehind)).toBe(true);
      expect(result.amountBehind).toBe(Math.round(500_000.5));
    }
  });

  it("returns pace_ahead with amountAhead 0 when today is before createdAt (elapsedDays clamped to 0)", () => {
    // today (FIXED_NOW = 2026-03-19) is before createdAt (2026-06-01)
    const goal = {
      targetAmount: 1_000_000,
      targetDate: "2027-06-01",
      createdAt: "2026-06-01T00:00:00.000Z",
    };
    const result = deriveGoalPaceGuidance(goal, 0, true, FIXED_NOW);
    // elapsedDays = max(0, negative) = 0 → expectedNow = 0 → delta = 0 → pace_ahead with 0
    expect(result).toEqual({ type: "pace_ahead", amountAhead: 0 });
  });
});

// ---------------------------------------------------------------------------
// deriveGoalCardStatus
// ---------------------------------------------------------------------------

describe("deriveGoalCardStatus", () => {
  it("returns completed when isComplete is true", () => {
    const progress = { percentComplete: 100, remaining: 0, isComplete: true };
    const result = deriveGoalCardStatus(progress, null);
    expect(result).toEqual({ kind: "completed" });
  });

  it("returns pace_ahead with amount when paceGuidance is pace_ahead", () => {
    const progress = { percentComplete: 60, remaining: 400_000, isComplete: false };
    const paceGuidance = { type: "pace_ahead" as const, amountAhead: 320_000 as CopAmount };
    const result = deriveGoalCardStatus(progress, paceGuidance);
    expect(result).toEqual({ kind: "pace_ahead", amount: 320_000 });
  });

  it("returns pace_behind with amount when paceGuidance is pace_behind with reason below_pace", () => {
    const progress = { percentComplete: 30, remaining: 700_000, isComplete: false };
    const paceGuidance = {
      type: "pace_behind" as const,
      amountBehind: 450_000 as CopAmount,
      reason: "below_pace" as const,
    };
    const result = deriveGoalCardStatus(progress, paceGuidance);
    expect(result).toEqual({ kind: "pace_behind", amount: 450_000 });
  });

  it("returns start_saving when paceGuidance is pace_behind with reason no_contributions", () => {
    const progress = { percentComplete: 0, remaining: 1_000_000, isComplete: false };
    const paceGuidance = {
      type: "pace_behind" as const,
      amountBehind: 0 as CopAmount,
      reason: "no_contributions" as const,
    };
    const result = deriveGoalCardStatus(progress, paceGuidance);
    expect(result).toEqual({ kind: "start_saving" });
  });

  it("returns almost_there when no paceGuidance and percentComplete >= 75", () => {
    const progress = { percentComplete: 80, remaining: 200_000, isComplete: false };
    const result = deriveGoalCardStatus(progress, null);
    expect(result).toEqual({ kind: "almost_there" });
  });

  it("returns null when no paceGuidance and percentComplete < 75", () => {
    const progress = { percentComplete: 40, remaining: 600_000, isComplete: false };
    const result = deriveGoalCardStatus(progress, null);
    expect(result).toBeNull();
  });

  it("returns almost_there when percentComplete is exactly 75 (boundary hit)", () => {
    const progress = { percentComplete: 75, remaining: 250_000, isComplete: false };
    const result = deriveGoalCardStatus(progress, null);
    expect(result).toEqual({ kind: "almost_there" });
  });

  it("returns null when percentComplete is 74 (just below boundary)", () => {
    const progress = { percentComplete: 74, remaining: 260_000, isComplete: false };
    const result = deriveGoalCardStatus(progress, null);
    expect(result).toBeNull();
  });

  it("returns completed when isComplete is true even with non-null paceGuidance (completed always wins)", () => {
    const progress = { percentComplete: 100, remaining: 0, isComplete: true };
    const paceGuidance = { type: "pace_ahead" as const, amountAhead: 100_000 as CopAmount };
    const result = deriveGoalCardStatus(progress, paceGuidance);
    expect(result).toEqual({ kind: "completed" });
  });
});
