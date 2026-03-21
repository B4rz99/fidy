import { describe, expect, it } from "vitest";
import type { BudgetProgress } from "@/features/budget/lib/derive";
import {
  deriveAutoSuggestBudgets,
  deriveBudgetAlerts,
  deriveBudgetProgress,
  deriveBudgetSummary,
} from "@/features/budget/lib/derive";
import type { BudgetId, CategoryId, CopAmount } from "@/shared/types/branded";

const makeBudget = (overrides: { id?: string; categoryId?: string; amount?: number } = {}) => ({
  id: "budget-1" as BudgetId,
  categoryId: "food" as CategoryId,
  amount: 500000 as CopAmount,
  ...(overrides as { id?: BudgetId; categoryId?: CategoryId; amount?: CopAmount }),
});

const makeProgress = (overrides: Partial<BudgetProgress> = {}): BudgetProgress => ({
  budgetId: "budget-1" as BudgetId,
  categoryId: "food" as CategoryId,
  amount: 500000 as CopAmount,
  spent: 350000 as CopAmount,
  percentUsed: 70,
  remaining: 150000 as CopAmount,
  isOverBudget: false,
  isNearLimit: false,
  ...overrides,
});

describe("deriveBudgetProgress", () => {
  it("returns 70% when 350000 spent of 500000", () => {
    const result = deriveBudgetProgress(makeBudget(), 350000 as CopAmount);
    expect(result.percentUsed).toBe(70);
    expect(result.isOverBudget).toBe(false);
    expect(result.isNearLimit).toBe(false);
  });

  it("returns correct remaining", () => {
    const result = deriveBudgetProgress(makeBudget(), 350000 as CopAmount);
    expect(result.remaining).toBe(150000);
    expect(result.spent).toBe(350000);
    expect(result.amount).toBe(500000);
  });

  it("sets isOverBudget=true when spent > amount", () => {
    const result = deriveBudgetProgress(makeBudget({ amount: 100000 }), 120000 as CopAmount);
    expect(result.isOverBudget).toBe(true);
    expect(result.remaining).toBe(-20000);
  });

  it("sets isNearLimit=true at exactly 80%", () => {
    const result = deriveBudgetProgress(makeBudget({ amount: 500000 }), 400000 as CopAmount);
    expect(result.percentUsed).toBe(80);
    expect(result.isNearLimit).toBe(true);
    expect(result.isOverBudget).toBe(false);
  });

  it("sets isNearLimit=false at 79%", () => {
    // 79% of 500000 = 395000
    const result = deriveBudgetProgress(makeBudget({ amount: 500000 }), 395000 as CopAmount);
    expect(result.percentUsed).toBe(79);
    expect(result.isNearLimit).toBe(false);
  });

  it("handles zero spending (0%)", () => {
    const result = deriveBudgetProgress(makeBudget({ amount: 500000 }), 0 as CopAmount);
    expect(result.percentUsed).toBe(0);
    expect(result.spent).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.isNearLimit).toBe(false);
    expect(result.remaining).toBe(500000);
  });

  it("handles spending equal to budget (100%, isOverBudget=false, isNearLimit=true)", () => {
    const result = deriveBudgetProgress(makeBudget({ amount: 500000 }), 500000 as CopAmount);
    expect(result.percentUsed).toBe(100);
    expect(result.isOverBudget).toBe(false);
    expect(result.isNearLimit).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("includes budgetId and categoryId from budget", () => {
    const result = deriveBudgetProgress(
      makeBudget({ id: "budget-42", categoryId: "transport" }),
      10000 as CopAmount
    );
    expect(result.budgetId).toBe("budget-42");
    expect(result.categoryId).toBe("transport");
  });
});

describe("deriveBudgetSummary", () => {
  it("totals all budgets and spent amounts correctly", () => {
    const progresses: BudgetProgress[] = [
      makeProgress({ amount: 500000 as CopAmount, spent: 350000 as CopAmount }),
      makeProgress({
        budgetId: "budget-2" as BudgetId,
        categoryId: "transport" as CategoryId,
        amount: 200000 as CopAmount,
        spent: 80000 as CopAmount,
        percentUsed: 40,
        remaining: 120000 as CopAmount,
        isOverBudget: false,
        isNearLimit: false,
      }),
    ];
    const result = deriveBudgetSummary(progresses);
    expect(result.totalBudget).toBe(700000);
    expect(result.totalSpent).toBe(430000);
    // 430000 / 700000 ≈ 61.4% → rounded to 61
    expect(result.percentUsed).toBe(61);
  });

  it("returns zeros for empty array", () => {
    const result = deriveBudgetSummary([]);
    expect(result.totalBudget).toBe(0);
    expect(result.totalSpent).toBe(0);
    expect(result.percentUsed).toBe(0);
  });
});

describe("deriveAutoSuggestBudgets", () => {
  // COP amounts in pesos directly
  const spending = [
    { categoryId: "food" as CategoryId, total: 18900 as CopAmount }, // 18,900 COP
    { categoryId: "transport" as CategoryId, total: 5234 as CopAmount }, // 5,234 COP
    { categoryId: "entertainment" as CategoryId, total: 187500 as CopAmount }, // 187,500 COP
  ];

  it("suggests budgets for categories with spending", () => {
    const result = deriveAutoSuggestBudgets(spending, new Set());
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.categoryId)).toContain("food");
    expect(result.map((r) => r.categoryId)).toContain("transport");
    expect(result.map((r) => r.categoryId)).toContain("entertainment");
  });

  it("excludes categories that already have budgets", () => {
    const existing = new Set<CategoryId>(["food" as CategoryId, "entertainment" as CategoryId]);
    const result = deriveAutoSuggestBudgets(spending, existing);
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe("transport");
  });

  it("rounds < 100k COP up to nearest 1,000 COP (18,900 → 19,000)", () => {
    const result = deriveAutoSuggestBudgets(
      [{ categoryId: "food" as CategoryId, total: 18900 as CopAmount }], // 18,900 COP
      new Set()
    );
    expect(result[0].suggestedAmount).toBe(19000);
  });

  it("rounds < 100k COP (5,234 → 6,000)", () => {
    const result = deriveAutoSuggestBudgets(
      [{ categoryId: "transport" as CategoryId, total: 5234 as CopAmount }], // 5,234 COP
      new Set()
    );
    expect(result[0].suggestedAmount).toBe(6000);
  });

  it("rounds 100k-1M COP up to nearest 10,000 COP (187,500 → 190,000)", () => {
    const result = deriveAutoSuggestBudgets(
      [{ categoryId: "entertainment" as CategoryId, total: 187500 as CopAmount }], // 187,500 COP
      new Set()
    );
    expect(result[0].suggestedAmount).toBe(190000);
  });

  it("rounds >= 1M COP up to nearest 100,000 COP (1,850,000 → 1,900,000)", () => {
    const result = deriveAutoSuggestBudgets(
      [{ categoryId: "home" as CategoryId, total: 1850000 as CopAmount }], // 1,850,000 COP
      new Set()
    );
    expect(result[0].suggestedAmount).toBe(1900000);
  });

  it("does not round exact multiples", () => {
    const result = deriveAutoSuggestBudgets(
      [{ categoryId: "food" as CategoryId, total: 20000 as CopAmount }], // 20,000 COP exact
      new Set()
    );
    expect(result[0].suggestedAmount).toBe(20000);
  });

  it("returns empty array when no spending data", () => {
    const result = deriveAutoSuggestBudgets([], new Set());
    expect(result).toHaveLength(0);
  });

  it("returns empty array when all categories already have budgets", () => {
    const existing = new Set<CategoryId>([
      "food" as CategoryId,
      "transport" as CategoryId,
      "entertainment" as CategoryId,
    ]);
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
