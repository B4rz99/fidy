import { describe, expect, it } from "vitest";
import {
  computePeriodRange,
  deriveCategoryBreakdown,
  deriveIncomeExpense,
  derivePeriodDelta,
} from "@/features/analytics/lib/derive";
import type { CategoryId, CopAmount } from "@/shared/types/branded";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const makeCategorySpending = (items: ReadonlyArray<{ categoryId: string; total: number }>) =>
  items.map((item) => ({
    categoryId: item.categoryId as CategoryId,
    total: item.total as CopAmount,
  }));

// ---------------------------------------------------------------------------
// computePeriodRange
// ---------------------------------------------------------------------------

describe("computePeriodRange", () => {
  // Reference: today = 2026-03-23 (Monday)
  const today = new Date(2026, 2, 23); // March 23 2026

  it("W: current ends today and starts 6 days ago", () => {
    const result = computePeriodRange("W", today);
    expect(result.current.end).toBe("2026-03-23");
    expect(result.current.start).toBe("2026-03-17");
  });

  it("W: previous ends 7 days ago and starts 13 days ago", () => {
    const result = computePeriodRange("W", today);
    expect(result.previous.end).toBe("2026-03-16");
    expect(result.previous.start).toBe("2026-03-10");
  });

  it("M: current ends today and starts 29 days ago", () => {
    const result = computePeriodRange("M", today);
    expect(result.current.end).toBe("2026-03-23");
    expect(result.current.start).toBe("2026-02-22");
  });

  it("M: previous ends 30 days ago and starts 59 days ago", () => {
    const result = computePeriodRange("M", today);
    expect(result.previous.end).toBe("2026-02-21");
    expect(result.previous.start).toBe("2026-01-23");
  });

  it("Q: current ends today and starts 89 days ago", () => {
    const result = computePeriodRange("Q", today);
    expect(result.current.end).toBe("2026-03-23");
    expect(result.current.start).toBe("2025-12-24");
  });

  it("Q: previous ends 90 days ago and starts 179 days ago", () => {
    const result = computePeriodRange("Q", today);
    expect(result.previous.end).toBe("2025-12-23");
    expect(result.previous.start).toBe("2025-09-25");
  });

  it("Y: current ends today and starts 364 days ago", () => {
    const result = computePeriodRange("Y", today);
    expect(result.current.end).toBe("2026-03-23");
    expect(result.current.start).toBe("2025-03-24");
  });

  it("Y: previous ends 365 days ago and starts 729 days ago", () => {
    const result = computePeriodRange("Y", today);
    expect(result.previous.end).toBe("2025-03-23");
    expect(result.previous.start).toBe("2024-03-24");
  });

  it("returns IsoDate strings (YYYY-MM-DD format)", () => {
    const result = computePeriodRange("W", today);
    expect(result.current.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.previous.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.previous.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles month/year boundary correctly (start of month today)", () => {
    const startOfMonth = new Date(2026, 2, 1); // March 1 2026
    const result = computePeriodRange("W", startOfMonth);
    expect(result.current.end).toBe("2026-03-01");
    expect(result.current.start).toBe("2026-02-23");
  });

  it("handles year boundary for Q period", () => {
    const newYear = new Date(2026, 0, 1); // Jan 1 2026
    const result = computePeriodRange("Q", newYear);
    expect(result.current.end).toBe("2026-01-01");
    expect(result.current.start).toBe("2025-10-04");
  });
});

// ---------------------------------------------------------------------------
// deriveIncomeExpense
// ---------------------------------------------------------------------------

describe("deriveIncomeExpense", () => {
  it("returns correct income, expenses, and net when income > expenses", () => {
    const result = deriveIncomeExpense(1000000 as CopAmount, 600000 as CopAmount);
    expect(result.income).toBe(1000000);
    expect(result.expenses).toBe(600000);
    expect(result.net).toBe(400000);
    expect(result.netIsPositive).toBe(true);
  });

  it("returns negative net when expenses > income", () => {
    const result = deriveIncomeExpense(500000 as CopAmount, 800000 as CopAmount);
    expect(result.net).toBe(-300000);
    expect(result.netIsPositive).toBe(false);
  });

  it("returns net=0 and netIsPositive=true when income equals expenses", () => {
    const result = deriveIncomeExpense(500000 as CopAmount, 500000 as CopAmount);
    expect(result.net).toBe(0);
    expect(result.netIsPositive).toBe(true);
  });

  it("returns net=0 when both income and expenses are zero", () => {
    const result = deriveIncomeExpense(0 as CopAmount, 0 as CopAmount);
    expect(result.income).toBe(0);
    expect(result.expenses).toBe(0);
    expect(result.net).toBe(0);
    expect(result.netIsPositive).toBe(true);
  });

  it("returns net equal to income when expenses are zero", () => {
    const result = deriveIncomeExpense(2000000 as CopAmount, 0 as CopAmount);
    expect(result.net).toBe(2000000);
    expect(result.netIsPositive).toBe(true);
  });

  it("returns net equal to negative expenses when income is zero", () => {
    const result = deriveIncomeExpense(0 as CopAmount, 300000 as CopAmount);
    expect(result.net).toBe(-300000);
    expect(result.netIsPositive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveCategoryBreakdown
// ---------------------------------------------------------------------------

describe("deriveCategoryBreakdown", () => {
  it("computes correct percent for a single category (100%)", () => {
    const spending = makeCategorySpending([{ categoryId: "food", total: 500000 }]);
    const result = deriveCategoryBreakdown(spending, 500000 as CopAmount);
    expect(result).toHaveLength(1);
    expect(result[0]!.percent).toBe(100);
    expect(result[0]!.categoryId).toBe("food");
    expect(result[0]!.total).toBe(500000);
  });

  it("computes correct percents for multiple categories", () => {
    const spending = makeCategorySpending([
      { categoryId: "food", total: 300000 },
      { categoryId: "transport", total: 100000 },
      { categoryId: "entertainment", total: 100000 },
    ]);
    const result = deriveCategoryBreakdown(spending, 500000 as CopAmount);
    const byId = new Map(result.map((item) => [item.categoryId, item]));
    expect(byId.get("food" as CategoryId)!.percent).toBe(60);
    expect(byId.get("transport" as CategoryId)!.percent).toBe(20);
    expect(byId.get("entertainment" as CategoryId)!.percent).toBe(20);
  });

  it("returns percent=0 for all categories when totalExpenses is 0", () => {
    const spending = makeCategorySpending([
      { categoryId: "food", total: 0 },
      { categoryId: "transport", total: 0 },
    ]);
    const result = deriveCategoryBreakdown(spending, 0 as CopAmount);
    expect(result.every((item) => item.percent === 0)).toBe(true);
  });

  it("returns empty array when spending is empty", () => {
    const result = deriveCategoryBreakdown([], 0 as CopAmount);
    expect(result).toHaveLength(0);
  });

  it("sorts results descending by total", () => {
    const spending = makeCategorySpending([
      { categoryId: "transport", total: 100000 },
      { categoryId: "food", total: 400000 },
      { categoryId: "entertainment", total: 50000 },
    ]);
    const result = deriveCategoryBreakdown(spending, 550000 as CopAmount);
    expect(result[0]!.categoryId).toBe("food");
    expect(result[1]!.categoryId).toBe("transport");
    expect(result[2]!.categoryId).toBe("entertainment");
  });

  it("preserves already-sorted input order (still sorted desc)", () => {
    const spending = makeCategorySpending([
      { categoryId: "food", total: 500000 },
      { categoryId: "transport", total: 200000 },
    ]);
    const result = deriveCategoryBreakdown(spending, 700000 as CopAmount);
    expect(result[0]!.categoryId).toBe("food");
    expect(result[1]!.categoryId).toBe("transport");
  });

  it("rounds percents to nearest integer", () => {
    // 100000 / 300000 = 33.333...% → rounds to 33
    const spending = makeCategorySpending([
      { categoryId: "food", total: 100000 },
      { categoryId: "transport", total: 100000 },
      { categoryId: "other", total: 100000 },
    ]);
    const result = deriveCategoryBreakdown(spending, 300000 as CopAmount);
    expect(result.every((item) => item.percent === 33)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// derivePeriodDelta
// ---------------------------------------------------------------------------

describe("derivePeriodDelta", () => {
  it("returns positive totalDelta and spendingIncreased=true when spending grew", () => {
    const result = derivePeriodDelta(
      {
        totalExpenses: 600000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 600000 }]),
      },
      {
        totalExpenses: 500000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 500000 }]),
      }
    );
    expect(result.totalDelta).toBe(100000);
    expect(result.spendingIncreased).toBe(true);
    expect(result.totalDeltaPercent).toBe(20);
  });

  it("returns negative totalDelta and spendingIncreased=false when spending decreased", () => {
    const result = derivePeriodDelta(
      {
        totalExpenses: 400000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 400000 }]),
      },
      {
        totalExpenses: 500000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 500000 }]),
      }
    );
    expect(result.totalDelta).toBe(-100000);
    expect(result.spendingIncreased).toBe(false);
    expect(result.totalDeltaPercent).toBe(-20);
  });

  it("returns zero totalDelta and spendingIncreased=false when unchanged", () => {
    const result = derivePeriodDelta(
      {
        totalExpenses: 500000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 500000 }]),
      },
      {
        totalExpenses: 500000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 500000 }]),
      }
    );
    expect(result.totalDelta).toBe(0);
    expect(result.spendingIncreased).toBe(false);
    expect(result.totalDeltaPercent).toBe(0);
  });

  it("returns totalDeltaPercent=100 when previous totalExpenses is 0 and current > 0", () => {
    const result = derivePeriodDelta(
      {
        totalExpenses: 300000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 300000 }]),
      },
      {
        totalExpenses: 0 as CopAmount,
        categorySpending: [],
      }
    );
    expect(result.totalDeltaPercent).toBe(100);
    expect(result.spendingIncreased).toBe(true);
  });

  it("returns totalDeltaPercent=0 when both current and previous are 0", () => {
    const result = derivePeriodDelta(
      { totalExpenses: 0 as CopAmount, categorySpending: [] },
      { totalExpenses: 0 as CopAmount, categorySpending: [] }
    );
    expect(result.totalDeltaPercent).toBe(0);
    expect(result.spendingIncreased).toBe(false);
  });

  it("assigns deltaPercent=100 for a new category in current not present in previous", () => {
    const result = derivePeriodDelta(
      {
        totalExpenses: 300000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 300000 }]),
      },
      {
        totalExpenses: 0 as CopAmount,
        categorySpending: [],
      }
    );
    expect(result.categoryDeltas).toHaveLength(1);
    expect(result.categoryDeltas[0]!.categoryId).toBe("food");
    expect(result.categoryDeltas[0]!.delta).toBe(300000);
    expect(result.categoryDeltas[0]!.deltaPercent).toBe(100);
    expect(result.categoryDeltas[0]!.increased).toBe(true);
  });

  it("computes correct per-category deltas for multiple categories", () => {
    const result = derivePeriodDelta(
      {
        totalExpenses: 700000 as CopAmount,
        categorySpending: makeCategorySpending([
          { categoryId: "food", total: 400000 },
          { categoryId: "transport", total: 300000 },
        ]),
      },
      {
        totalExpenses: 600000 as CopAmount,
        categorySpending: makeCategorySpending([
          { categoryId: "food", total: 300000 },
          { categoryId: "transport", total: 300000 },
        ]),
      }
    );
    const byId = new Map(result.categoryDeltas.map((d) => [d.categoryId, d]));
    expect(byId.get("food" as CategoryId)!.delta).toBe(100000);
    expect(byId.get("food" as CategoryId)!.increased).toBe(true);
    expect(byId.get("transport" as CategoryId)!.delta).toBe(0);
    expect(byId.get("transport" as CategoryId)!.increased).toBe(false);
  });

  it("returns empty categoryDeltas when current has no category spending", () => {
    const result = derivePeriodDelta(
      { totalExpenses: 0 as CopAmount, categorySpending: [] },
      {
        totalExpenses: 500000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 500000 }]),
      }
    );
    expect(result.categoryDeltas).toHaveLength(0);
  });

  it("rounds deltaPercent to nearest integer", () => {
    // 400000 → 600000: delta = 200000, pct = 200000/400000 = 50%
    const result = derivePeriodDelta(
      {
        totalExpenses: 600000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 600000 }]),
      },
      {
        totalExpenses: 400000 as CopAmount,
        categorySpending: makeCategorySpending([{ categoryId: "food", total: 400000 }]),
      }
    );
    expect(result.categoryDeltas[0]!.deltaPercent).toBe(50);
  });
});
