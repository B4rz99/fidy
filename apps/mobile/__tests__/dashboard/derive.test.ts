import { describe, expect, it } from "vitest";
import { computeDashboardRange, deriveCategoryPercents } from "@/features/dashboard/lib/derive";
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
// computeDashboardRange
// ---------------------------------------------------------------------------

describe("computeDashboardRange", () => {
  // Reference: today = 2026-03-23 (Monday)
  const today = new Date(2026, 2, 23); // March 23 2026

  // -- "today" period --

  it("today: spending range is today–today", () => {
    const result = computeDashboardRange("today", today);
    expect(result.spending.start).toBe("2026-03-23");
    expect(result.spending.end).toBe("2026-03-23");
  });

  it("today: lineChart range is today-6d–today (7-day context)", () => {
    const result = computeDashboardRange("today", today);
    expect(result.lineChart.start).toBe("2026-03-17");
    expect(result.lineChart.end).toBe("2026-03-23");
  });

  // -- "week" period --

  it("week: spending range is today-6d–today", () => {
    const result = computeDashboardRange("week", today);
    expect(result.spending.start).toBe("2026-03-17");
    expect(result.spending.end).toBe("2026-03-23");
  });

  it("week: lineChart range is today-6d–today", () => {
    const result = computeDashboardRange("week", today);
    expect(result.lineChart.start).toBe("2026-03-17");
    expect(result.lineChart.end).toBe("2026-03-23");
  });

  // -- "month" period --

  it("month: spending range is 1st–last of current calendar month", () => {
    const result = computeDashboardRange("month", today);
    expect(result.spending.start).toBe("2026-03-01");
    expect(result.spending.end).toBe("2026-03-31");
  });

  it("month: lineChart range is today-29d–today", () => {
    const result = computeDashboardRange("month", today);
    expect(result.lineChart.start).toBe("2026-02-22");
    expect(result.lineChart.end).toBe("2026-03-23");
  });

  // -- Month boundaries --

  it("month boundary: first day of month spending covers full calendar month", () => {
    const firstOfMonth = new Date(2026, 2, 1); // March 1 2026
    const result = computeDashboardRange("month", firstOfMonth);
    expect(result.spending.start).toBe("2026-03-01");
    expect(result.spending.end).toBe("2026-03-31");
  });

  it("month boundary: last day of month spending covers full calendar month", () => {
    const lastOfMonth = new Date(2026, 2, 31); // March 31 2026
    const result = computeDashboardRange("month", lastOfMonth);
    expect(result.spending.start).toBe("2026-03-01");
    expect(result.spending.end).toBe("2026-03-31");
  });

  it("month boundary: first day of month lineChart starts 29 days before", () => {
    const firstOfMonth = new Date(2026, 2, 1); // March 1 2026
    const result = computeDashboardRange("month", firstOfMonth);
    expect(result.lineChart.start).toBe("2026-01-31");
    expect(result.lineChart.end).toBe("2026-03-01");
  });

  it("month boundary: February (non-leap year) has correct last day", () => {
    const febDay = new Date(2026, 1, 15); // February 15 2026
    const result = computeDashboardRange("month", febDay);
    expect(result.spending.start).toBe("2026-02-01");
    expect(result.spending.end).toBe("2026-02-28");
  });

  it("month boundary: February (leap year) has correct last day", () => {
    const febDay = new Date(2028, 1, 15); // February 15 2028 (leap year)
    const result = computeDashboardRange("month", febDay);
    expect(result.spending.start).toBe("2028-02-01");
    expect(result.spending.end).toBe("2028-02-29");
  });

  // -- Cross-month boundary for week --

  it("week: spending range crosses month boundary correctly", () => {
    const startOfMonth = new Date(2026, 2, 2); // March 2 2026
    const result = computeDashboardRange("week", startOfMonth);
    expect(result.spending.start).toBe("2026-02-24");
    expect(result.spending.end).toBe("2026-03-02");
  });

  // -- IsoDate format --

  it("returns IsoDate strings (YYYY-MM-DD format)", () => {
    const result = computeDashboardRange("today", today);
    expect(result.spending.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.spending.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.lineChart.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.lineChart.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// deriveCategoryPercents
// ---------------------------------------------------------------------------

describe("deriveCategoryPercents", () => {
  it("computes correct percent for a single category (100%)", () => {
    const categories = makeCategorySpending([{ categoryId: "food", total: 500000 }]);
    const result = deriveCategoryPercents(categories, 500000 as CopAmount);
    expect(result).toHaveLength(1);
    expect(result[0]?.categoryId).toBe("food");
    expect(result[0]?.total).toBe(500000);
    expect(result[0]?.percent).toBe(100);
  });

  it("computes correct percents for multiple categories", () => {
    const categories = makeCategorySpending([
      { categoryId: "food", total: 300000 },
      { categoryId: "transport", total: 100000 },
      { categoryId: "entertainment", total: 100000 },
    ]);
    const result = deriveCategoryPercents(categories, 500000 as CopAmount);
    const byId = new Map(result.map((item) => [item.categoryId, item]));
    expect(byId.get("food" as CategoryId)?.percent).toBe(60);
    expect(byId.get("transport" as CategoryId)?.percent).toBe(20);
    expect(byId.get("entertainment" as CategoryId)?.percent).toBe(20);
  });

  it("returns empty array when categories is empty", () => {
    const result = deriveCategoryPercents([], 0 as CopAmount);
    expect(result).toHaveLength(0);
  });

  it("returns percent=0 for all categories when totalSpent is 0", () => {
    const categories = makeCategorySpending([
      { categoryId: "food", total: 0 },
      { categoryId: "transport", total: 0 },
    ]);
    const result = deriveCategoryPercents(categories, 0 as CopAmount);
    expect(result.every((item) => item.percent === 0)).toBe(true);
  });

  it("rounds percents to nearest integer", () => {
    // 100000 / 300000 = 33.333...% -> rounds to 33
    const categories = makeCategorySpending([
      { categoryId: "food", total: 100000 },
      { categoryId: "transport", total: 100000 },
      { categoryId: "other", total: 100000 },
    ]);
    const result = deriveCategoryPercents(categories, 300000 as CopAmount);
    expect(result.every((item) => item.percent === 33)).toBe(true);
  });

  it("preserves original category fields in returned items", () => {
    const categories = makeCategorySpending([
      { categoryId: "food", total: 250000 },
      { categoryId: "transport", total: 250000 },
    ]);
    const result = deriveCategoryPercents(categories, 500000 as CopAmount);
    expect(result[0]?.categoryId).toBe("food");
    expect(result[0]?.total).toBe(250000);
    expect(result[1]?.categoryId).toBe("transport");
    expect(result[1]?.total).toBe(250000);
  });
});
