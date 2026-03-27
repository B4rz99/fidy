import { describe, expect, it } from "vitest";
import { computeDashboardRange } from "@/features/dashboard/lib/derive";

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
