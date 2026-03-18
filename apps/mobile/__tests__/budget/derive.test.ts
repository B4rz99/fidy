import { describe, expect, it } from "vitest";
import type { BudgetProgress } from "@/features/budget/lib/derive";
import {
  deriveAutoSuggestBudgets,
  deriveBudgetAlerts,
  deriveBudgetProgress,
  deriveBudgetSummary,
} from "@/features/budget/lib/derive";

const makeBudget = (
  overrides: { id?: string; categoryId?: string; amountCents?: number } = {}
) => ({
  id: "budget-1",
  categoryId: "food",
  amountCents: 500000,
  ...overrides,
});

const makeProgress = (overrides: Partial<BudgetProgress> = {}): BudgetProgress => ({
  budgetId: "budget-1",
  categoryId: "food",
  amountCents: 500000,
  spentCents: 350000,
  percentUsed: 70,
  remainingCents: 150000,
  isOverBudget: false,
  isNearLimit: false,
  ...overrides,
});

describe("deriveBudgetProgress", () => {
  it("returns 70% when 350000 spent of 500000", () => {
    const result = deriveBudgetProgress(makeBudget(), 350000);
    expect(result.percentUsed).toBe(70);
    expect(result.isOverBudget).toBe(false);
    expect(result.isNearLimit).toBe(false);
  });

  it("returns correct remainingCents", () => {
    const result = deriveBudgetProgress(makeBudget(), 350000);
    expect(result.remainingCents).toBe(150000);
    expect(result.spentCents).toBe(350000);
    expect(result.amountCents).toBe(500000);
  });

  it("sets isOverBudget=true when spent > amount", () => {
    const result = deriveBudgetProgress(makeBudget({ amountCents: 100000 }), 120000);
    expect(result.isOverBudget).toBe(true);
    expect(result.remainingCents).toBe(-20000);
  });

  it("sets isNearLimit=true at exactly 80%", () => {
    const result = deriveBudgetProgress(makeBudget({ amountCents: 500000 }), 400000);
    expect(result.percentUsed).toBe(80);
    expect(result.isNearLimit).toBe(true);
    expect(result.isOverBudget).toBe(false);
  });

  it("sets isNearLimit=false at 79%", () => {
    // 79% of 500000 = 395000
    const result = deriveBudgetProgress(makeBudget({ amountCents: 500000 }), 395000);
    expect(result.percentUsed).toBe(79);
    expect(result.isNearLimit).toBe(false);
  });

  it("handles zero spending (0%)", () => {
    const result = deriveBudgetProgress(makeBudget({ amountCents: 500000 }), 0);
    expect(result.percentUsed).toBe(0);
    expect(result.spentCents).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.isNearLimit).toBe(false);
    expect(result.remainingCents).toBe(500000);
  });

  it("handles spending equal to budget (100%, isOverBudget=false, isNearLimit=true)", () => {
    const result = deriveBudgetProgress(makeBudget({ amountCents: 500000 }), 500000);
    expect(result.percentUsed).toBe(100);
    expect(result.isOverBudget).toBe(false);
    expect(result.isNearLimit).toBe(true);
    expect(result.remainingCents).toBe(0);
  });

  it("includes budgetId and categoryId from budget", () => {
    const result = deriveBudgetProgress(
      makeBudget({ id: "budget-42", categoryId: "transport" }),
      10000
    );
    expect(result.budgetId).toBe("budget-42");
    expect(result.categoryId).toBe("transport");
  });
});

describe("deriveBudgetSummary", () => {
  it("totals all budgets and spent amounts correctly", () => {
    const progresses: BudgetProgress[] = [
      makeProgress({ amountCents: 500000, spentCents: 350000 }),
      makeProgress({
        budgetId: "budget-2",
        categoryId: "transport",
        amountCents: 200000,
        spentCents: 80000,
        percentUsed: 40,
        remainingCents: 120000,
        isOverBudget: false,
        isNearLimit: false,
      }),
    ];
    const result = deriveBudgetSummary(progresses);
    expect(result.totalBudgetCents).toBe(700000);
    expect(result.totalSpentCents).toBe(430000);
    // 430000 / 700000 ≈ 61.4% → rounded to 61
    expect(result.percentUsed).toBe(61);
  });

  it("returns zeros for empty array", () => {
    const result = deriveBudgetSummary([]);
    expect(result.totalBudgetCents).toBe(0);
    expect(result.totalSpentCents).toBe(0);
    expect(result.percentUsed).toBe(0);
  });
});

describe("deriveAutoSuggestBudgets", () => {
  const spending = [
    { categoryId: "food", totalCents: 45000 },
    { categoryId: "transport", totalCents: 15234 },
    { categoryId: "entertainment", totalCents: 30000 },
  ];

  it("suggests budgets for categories with spending", () => {
    const result = deriveAutoSuggestBudgets(spending, new Set());
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.categoryId)).toContain("food");
    expect(result.map((r) => r.categoryId)).toContain("transport");
    expect(result.map((r) => r.categoryId)).toContain("entertainment");
  });

  it("excludes categories that already have budgets", () => {
    const existing = new Set(["food", "entertainment"]);
    const result = deriveAutoSuggestBudgets(spending, existing);
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe("transport");
  });

  it("rounds suggested amounts up to nearest 100 cents (15234 → 15300)", () => {
    const result = deriveAutoSuggestBudgets(
      [{ categoryId: "transport", totalCents: 15234 }],
      new Set()
    );
    expect(result[0].suggestedAmountCents).toBe(15300);
  });

  it("does not round exact multiples of 100", () => {
    const result = deriveAutoSuggestBudgets([{ categoryId: "food", totalCents: 45000 }], new Set());
    expect(result[0].suggestedAmountCents).toBe(45000);
  });

  it("returns empty array when no spending data", () => {
    const result = deriveAutoSuggestBudgets([], new Set());
    expect(result).toHaveLength(0);
  });

  it("returns empty array when all categories already have budgets", () => {
    const existing = new Set(["food", "transport", "entertainment"]);
    const result = deriveAutoSuggestBudgets(spending, existing);
    expect(result).toHaveLength(0);
  });
});

describe("deriveBudgetAlerts", () => {
  it("returns alert for budget at 80%", () => {
    const progresses = [makeProgress({ percentUsed: 80, isNearLimit: true })];
    const result = deriveBudgetAlerts(progresses, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].threshold).toBe(80);
    expect(result[0].budgetId).toBe("budget-1");
    expect(result[0].categoryId).toBe("food");
    expect(result[0].percentUsed).toBe(80);
  });

  it("returns alert for budget at 100%+", () => {
    const progresses = [makeProgress({ percentUsed: 110, isOverBudget: true, isNearLimit: true })];
    const result = deriveBudgetAlerts(progresses, new Set());
    // Both 80 and 100 thresholds crossed
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.threshold)).toContain(80);
    expect(result.map((a) => a.threshold)).toContain(100);
  });

  it("excludes acknowledged alerts", () => {
    const progresses = [makeProgress({ percentUsed: 80, isNearLimit: true })];
    const acknowledged = new Set(["budget-1:80"]);
    const result = deriveBudgetAlerts(progresses, acknowledged);
    expect(result).toHaveLength(0);
  });

  it("only excludes the specific acknowledged threshold, not all", () => {
    const progresses = [makeProgress({ percentUsed: 110, isOverBudget: true, isNearLimit: true })];
    const acknowledged = new Set(["budget-1:80"]);
    const result = deriveBudgetAlerts(progresses, acknowledged);
    expect(result).toHaveLength(1);
    expect(result[0].threshold).toBe(100);
  });

  it("returns both 80 and 100 alerts for same budget if both crossed", () => {
    const progresses = [makeProgress({ percentUsed: 100, isNearLimit: true, isOverBudget: false })];
    const result = deriveBudgetAlerts(progresses, new Set());
    expect(result).toHaveLength(2);
    const thresholds = result.map((a) => a.threshold);
    expect(thresholds).toContain(80);
    expect(thresholds).toContain(100);
  });

  it("returns empty when all under 80%", () => {
    const progresses = [makeProgress({ percentUsed: 70, isNearLimit: false })];
    const result = deriveBudgetAlerts(progresses, new Set());
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty progresses", () => {
    const result = deriveBudgetAlerts([], new Set());
    expect(result).toHaveLength(0);
  });
});
