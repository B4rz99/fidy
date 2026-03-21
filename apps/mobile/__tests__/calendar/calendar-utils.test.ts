import { describe, expect, test } from "vitest";

import {
  formatMonthYear,
  getBillsForDate,
  getMonthGrid,
  getNextOccurrence,
  WEEKDAY_LABELS,
} from "@/features/calendar/lib/calendar-utils";
import type { Bill } from "@/features/calendar/schema";
import type { CategoryId } from "@/shared/types/branded";

const makeBill = (overrides: Partial<Bill> = {}): Bill => ({
  id: "b1",
  name: "Test",
  amount: 50000,
  frequency: "monthly",
  categoryId: "services" as CategoryId,
  startDate: new Date(2025, 0, 15),
  isActive: true,
  ...overrides,
});

// ─── WEEKDAY_LABELS ───

describe("WEEKDAY_LABELS", () => {
  test("has 7 entries starting Mon and ending Sun", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe("M");
    expect(WEEKDAY_LABELS[6]).toBe("S");
  });
});

// ─── formatMonthYear ───

describe("formatMonthYear", () => {
  test("formats January 2026", () => {
    expect(formatMonthYear(new Date(2026, 0, 1))).toBe("January 2026");
  });

  test("formats December 2025", () => {
    expect(formatMonthYear(new Date(2025, 11, 15))).toBe("December 2025");
  });
});

// ─── getMonthGrid ───

describe("getMonthGrid", () => {
  test("returns correct number of weeks for Feb 2026 (starts Sun)", () => {
    // Feb 2026: 28 days, Feb 1 is Sunday → Mon-start offset = 6
    // 6 + 28 = 34 cells → ceil(34/7) = 5 weeks
    const grid = getMonthGrid(2026, 1);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(7);
  });

  test("first row pads nulls before first day of month", () => {
    // March 2026: Mar 1 is Sunday → Mon-start offset = 6
    const grid = getMonthGrid(2026, 2);
    // First 6 cells should be null (Mon-Sat padding), then day 1 on Sunday
    for (let i = 0; i < 6; i++) {
      expect(grid[0][i].day).toBeNull();
    }
    expect(grid[0][6].day).toBe(1);
  });

  test("last row pads nulls after last day of month", () => {
    // Feb 2026: 28 days, starts on Sunday (offset=6), so last day (28) is Saturday
    const grid = getMonthGrid(2026, 1);
    const lastWeek = grid[grid.length - 1];
    // Day 28 should be on Saturday (index 5), Sunday (index 6) should be null
    expect(lastWeek[5].day).toBe(28);
    expect(lastWeek[6].day).toBeNull();
  });

  test("all non-null cells have correct date objects", () => {
    const grid = getMonthGrid(2026, 0); // January 2026
    for (const week of grid) {
      for (const cell of week) {
        if (cell.day !== null) {
          expect(cell.date).not.toBeNull();
          const d = cell.date as Date;
          expect(d.getFullYear()).toBe(2026);
          expect(d.getMonth()).toBe(0);
          expect(d.getDate()).toBe(cell.day);
        } else {
          expect(cell.date).toBeNull();
        }
      }
    }
  });

  test("month with 31 days includes all days", () => {
    const grid = getMonthGrid(2026, 0); // January 2026: 31 days
    const allDays = grid
      .flat()
      .filter((c) => c.day !== null)
      .map((c) => c.day);
    expect(allDays).toHaveLength(31);
    expect(allDays[0]).toBe(1);
    expect(allDays[30]).toBe(31);
  });
});

// ─── getBillsForDate ───

describe("getBillsForDate", () => {
  test("matches monthly bill on same day-of-month", () => {
    const bill = makeBill();
    const result = getBillsForDate([bill], new Date(2026, 2, 15)); // Mar 15
    expect(result).toContain(bill);
  });

  test("excludes inactive bill", () => {
    const bill = makeBill({ isActive: false });
    expect(getBillsForDate([bill], new Date(2026, 2, 15))).toEqual([]);
  });

  test("excludes bill before its start date", () => {
    const bill = makeBill({ startDate: new Date(2026, 5, 1) });
    expect(getBillsForDate([bill], new Date(2026, 2, 15))).toEqual([]);
  });

  test("matches weekly bill on same day-of-week", () => {
    // Jan 6 2025 is a Monday
    const bill = makeBill({ frequency: "weekly", startDate: new Date(2025, 0, 6) });
    // Mar 3 2025 is also a Monday
    expect(getBillsForDate([bill], new Date(2025, 2, 3))).toContain(bill);
  });

  test("matches biweekly bill on correct week", () => {
    const bill = makeBill({ frequency: "biweekly", startDate: new Date(2025, 0, 6) });
    // 2 weeks later: Jan 20 2025
    expect(getBillsForDate([bill], new Date(2025, 0, 20))).toContain(bill);
    // 1 week later: Jan 13 2025 — wrong week
    expect(getBillsForDate([bill], new Date(2025, 0, 13))).toEqual([]);
  });

  test("matches yearly bill on same month and day", () => {
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2025, 2, 22) });
    expect(getBillsForDate([bill], new Date(2026, 2, 22))).toContain(bill);
    expect(getBillsForDate([bill], new Date(2026, 3, 22))).toEqual([]);
  });

  test("excludes bill with unknown frequency", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing unknown frequency branch
    const bill = makeBill({ frequency: "unknown" as any });
    expect(getBillsForDate([bill], new Date(2026, 0, 15))).toEqual([]);
  });

  // BUG 1a: monthly bill starting Jan 31 should match Apr 30 (last valid day)
  test("monthly bill day-31 matches on Apr 30 (day overflow clamped)", () => {
    const bill = makeBill({ startDate: new Date(2025, 0, 31) }); // Jan 31
    // April only has 30 days — bill should fire on Apr 30
    const result = getBillsForDate([bill], new Date(2026, 3, 30)); // Apr 30
    expect(result).toContain(bill);
  });

  // BUG 1b: yearly bill Feb 29 should match Feb 28 in non-leap year
  test("yearly bill Feb 29 matches Feb 28 in non-leap year", () => {
    // 2024 is a leap year
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2024, 1, 29) });
    // 2025 is not a leap year — should match Feb 28
    const result = getBillsForDate([bill], new Date(2025, 1, 28));
    expect(result).toContain(bill);
  });
});

// ─── getNextOccurrence ───

describe("getNextOccurrence", () => {
  test("monthly: next occurrence is in same month if not yet passed", () => {
    const bill = makeBill({ startDate: new Date(2025, 0, 20) }); // Jan 20
    const next = getNextOccurrence(bill, new Date(2026, 2, 10)); // Mar 10
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(2);
    expect(next.getDate()).toBe(20);
  });

  test("monthly: next occurrence rolls to next month if already passed", () => {
    const bill = makeBill({ startDate: new Date(2025, 0, 5) }); // Jan 5
    const next = getNextOccurrence(bill, new Date(2026, 2, 10)); // Mar 10
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3); // April
    expect(next.getDate()).toBe(5);
  });

  test("weekly: next occurrence on same day-of-week", () => {
    // Jan 6 2025 is Monday
    const bill = makeBill({ frequency: "weekly", startDate: new Date(2025, 0, 6) });
    const next = getNextOccurrence(bill, new Date(2026, 2, 11)); // Mar 11 2026 is Wednesday
    // Next Monday is Mar 16
    expect(next.getDay()).toBe(1); // Monday
    expect(next >= new Date(2026, 2, 11)).toBe(true);
  });

  test("biweekly: advances in 2-week increments from start", () => {
    const bill = makeBill({ frequency: "biweekly", startDate: new Date(2025, 0, 6) });
    const next = getNextOccurrence(bill, new Date(2025, 0, 7));
    // 2 weeks after Jan 6 = Jan 20
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(20);
  });

  test("yearly: same year if not yet passed", () => {
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2025, 5, 15) });
    const next = getNextOccurrence(bill, new Date(2026, 2, 1));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(15);
  });

  test("yearly: rolls to next year if already passed", () => {
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2025, 0, 15) });
    const next = getNextOccurrence(bill, new Date(2026, 2, 1));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(15);
  });

  // BUG 1c: monthly day-31 in April (30 days) should return Apr 30, not May 1
  test("monthly day-31 in April returns Apr 30 (clamped, no rollover)", () => {
    const bill = makeBill({ startDate: new Date(2025, 0, 31) }); // Jan 31
    const next = getNextOccurrence(bill, new Date(2026, 3, 1)); // from Apr 1
    expect(next.getMonth()).toBe(3); // Should stay in April
    expect(next.getDate()).toBe(30); // Clamped to last day
  });

  // BUG 1d: yearly Feb 29 in non-leap year should return Feb 28, not Mar 1
  test("yearly Feb 29 in non-leap year returns Feb 28 (clamped)", () => {
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2024, 1, 29) });
    const next = getNextOccurrence(bill, new Date(2025, 0, 1));
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(28); // Clamped
  });

  // Bill due today should not skip to next period when called mid-day
  test("monthly bill due today returns today even when called in the afternoon", () => {
    const bill = makeBill({ startDate: new Date(2025, 0, 15) }); // 15th monthly
    const afternoon = new Date(2026, 2, 15, 14, 30, 0); // Mar 15 at 2:30pm
    const next = getNextOccurrence(bill, afternoon);
    expect(next.getMonth()).toBe(2); // March, not April
    expect(next.getDate()).toBe(15);
  });

  test("yearly bill due today returns today even when called in the afternoon", () => {
    const bill = makeBill({ frequency: "yearly", startDate: new Date(2025, 5, 15) });
    const afternoon = new Date(2026, 5, 15, 18, 0, 0); // Jun 15 at 6pm
    const next = getNextOccurrence(bill, afternoon);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(15);
  });
});
