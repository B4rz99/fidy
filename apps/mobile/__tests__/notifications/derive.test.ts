import { describe, expect, it } from "vitest";
import type { BudgetProgress } from "@/features/budget/lib/derive";
import type { WeeklyMove } from "@/features/notifications/lib/derive";
import { deriveWeeklyMoves } from "@/features/notifications/lib/derive";
import type { StoredTransaction } from "@/features/transactions/schema";
import type {
  BudgetId,
  CategoryId,
  CopAmount,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

// ---------------------------------------------------------------------------
// Type predicates for discriminated union narrowing in filter()
// ---------------------------------------------------------------------------

const isAnomaly = (m: WeeklyMove): m is Extract<WeeklyMove, { type: "anomaly" }> =>
  m.type === "anomaly";
const isBudgetPace = (m: WeeklyMove): m is Extract<WeeklyMove, { type: "budget_pace" }> =>
  m.type === "budget_pace";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

// Use local noon to avoid UTC-midnight timezone drift on date-fns getDate()
const WEEK_START = new Date("2026-03-16T12:00:00"); // Monday

const makeTx = (overrides: Partial<StoredTransaction> = {}): StoredTransaction => ({
  id: "tx-1" as TransactionId,
  userId: "u1" as UserId,
  type: "expense",
  amount: 100_000 as CopAmount,
  categoryId: "food" as CategoryId,
  description: "",
  date: new Date("2026-03-16T12:00:00"),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const makeProgress = (overrides: Partial<BudgetProgress> = {}): BudgetProgress => ({
  budgetId: "b1" as BudgetId,
  categoryId: "food" as CategoryId,
  amount: 500_000 as CopAmount,
  spent: 0 as CopAmount,
  percentUsed: 0,
  remaining: 500_000 as CopAmount,
  isOverBudget: false,
  isNearLimit: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers for building prior-week transactions
// ---------------------------------------------------------------------------

/**
 * Returns a date that falls in "prior week bucket" N (0-indexed).
 * Bucket 0 = days 1–7 before weekStart (i.e., 1 to 7 days prior).
 * We use the midpoint of the bucket: day (N * 7 + 4) before weekStart.
 */
const priorDate = (bucket: number): Date => {
  const daysBack = bucket * 7 + 4; // midpoint of the 7-day bucket
  const d = new Date(WEEK_START);
  d.setDate(d.getDate() - daysBack);
  return d;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deriveWeeklyMoves", () => {
  // Test 1 — empty inputs → empty output
  it("returns empty array for empty transactions and progresses", () => {
    const result = deriveWeeklyMoves([], [], WEEK_START);
    expect(result).toEqual([]);
  });

  // Test 2 — fewer than 5 prior transactions → no anomaly
  it("emits no anomaly when category has fewer than 5 prior transactions", () => {
    // 4 prior transactions in "food" category
    const prior = Array.from({ length: 4 }, (_, i) =>
      makeTx({ date: priorDate(i), amount: 50_000 as CopAmount })
    );
    // Current week: high spend — but still no anomaly due to < 5 prior
    const currentWeekTx = makeTx({
      date: new Date("2026-03-16T12:00:00"),
      amount: 1_000_000 as CopAmount,
    });
    const result = deriveWeeklyMoves([...prior, currentWeekTx], [], WEEK_START);
    expect(result.filter((m) => m.type === "anomaly")).toHaveLength(0);
  });

  // Test 3 — 5+ prior txns but spend ≤ 1.5× median → no anomaly
  it("emits no anomaly when this-week spend does not exceed 1.5× median", () => {
    // 5 prior transactions, each 100_000 → weekly totals spread across buckets
    // Median ≈ 100_000. Current week spend = 140_000 (< 150_000 = 1.5×)
    const prior = Array.from({ length: 5 }, (_, i) =>
      makeTx({ date: priorDate(i % 5), amount: 100_000 as CopAmount })
    );
    const currentWeekTx = makeTx({
      date: new Date("2026-03-16T12:00:00"),
      amount: 140_000 as CopAmount,
    });
    const result = deriveWeeklyMoves([...prior, currentWeekTx], [], WEEK_START);
    expect(result.filter((m) => m.type === "anomaly")).toHaveLength(0);
  });

  // Test 4 — 5 prior txns, this-week spend > 1.5× median → AnomalyMove emitted
  it("emits AnomalyMove when this-week spend exceeds 1.5× median of prior weekly spend", () => {
    // 5 prior transactions each in its own week bucket, each 100_000 → 1 per bucket
    // weeklyTotals: {0: 100k, 1: 100k, 2: 100k, 3: 100k, 4: 100k} → median = 100_000
    // 1.5 × 100_000 = 150_000; current week = 200_000 → anomaly
    const prior = Array.from({ length: 5 }, (_, i) =>
      makeTx({ date: priorDate(i), amount: 100_000 as CopAmount })
    );
    const currentWeekTx = makeTx({
      date: new Date("2026-03-17T12:00:00"), // within current week (Mon–Sun: 2026-03-16 to 2026-03-22)
      amount: 200_000 as CopAmount,
    });
    const result = deriveWeeklyMoves([...prior, currentWeekTx], [], WEEK_START);
    const anomalies = result.filter(isAnomaly);
    expect(anomalies).toHaveLength(1);
    const anomaly = anomalies[0]!;
    expect(anomaly.type).toBe("anomaly");
    expect(anomaly.categoryId).toBe("food");
    expect(anomaly.weeklySpend).toBe(200_000);
    expect(anomaly.medianWeeklySpend).toBe(100_000);
    expect(anomaly.impact).toBe(100_000); // 200_000 − 100_000
  });

  // Test 5 — no budget progresses → no pace moves
  it("emits no budget pace moves when progresses array is empty", () => {
    const txs = [makeTx({ date: new Date("2026-03-16T12:00:00"), amount: 200_000 as CopAmount })];
    const result = deriveWeeklyMoves(txs, [], WEEK_START);
    expect(result.filter((m) => m.type === "budget_pace")).toHaveLength(0);
  });

  // Test 6 — projected ≤ budget → no pace move
  it("emits no pace move when projected spend is within budget", () => {
    // weekStart = 2026-03-16, daysInMonth(March) = 31, getDate = 16
    // remainingDays = 31 - 16 + 1 = 16
    // thisWeekSpend = 0 (no current-week txns for "food")
    // weekDailyRate = 0/7 = 0
    // projected = spent + 0 × 16 = 0 → under 500_000 budget
    const result = deriveWeeklyMoves([], [makeProgress()], WEEK_START);
    expect(result.filter((m) => m.type === "budget_pace")).toHaveLength(0);
  });

  // Test 7 — projected > budget → BudgetPaceMove emitted
  it("emits BudgetPaceMove when projected spend exceeds budget", () => {
    // weekStart = 2026-03-16, remainingDays = 16
    // thisWeekSpend for "food" = 700_000
    // weekDailyRate = 700_000 / 7 = 100_000/day
    // projected = 0 (spent) + 100_000 × 16 = 1_600_000 > 500_000
    // impact = 1_600_000 − 500_000 = 1_100_000
    const currentWeekTx = makeTx({
      date: new Date("2026-03-16T12:00:00"),
      amount: 700_000 as CopAmount,
    });
    const progress = makeProgress({
      amount: 500_000 as CopAmount,
      spent: 0 as CopAmount,
    });
    const result = deriveWeeklyMoves([currentWeekTx], [progress], WEEK_START);
    const paces = result.filter(isBudgetPace);
    expect(paces).toHaveLength(1);
    const pace = paces[0]!;
    expect(pace.type).toBe("budget_pace");
    expect(pace.budgetId).toBe("b1");
    expect(pace.categoryId).toBe("food");
    expect(pace.budgetAmount).toBe(500_000);
    // projected = 0 + (700_000/7) × 16 = 1_600_000
    expect(pace.projectedSpend).toBe(1_600_000);
    // impact = 1_600_000 − 500_000 = 1_100_000
    expect(pace.impact).toBe(1_100_000);
  });

  // Test 8 — thisWeekSpend = 0 → weekDailyRate = 0, projected = spent, no alert if under budget
  it("emits no pace move when thisWeekSpend is zero and existing spend is under budget", () => {
    // spent = 200_000, weekDailyRate = 0, projected = 200_000, budget = 500_000 → no alert
    const progress = makeProgress({
      amount: 500_000 as CopAmount,
      spent: 200_000 as CopAmount,
    });
    const result = deriveWeeklyMoves([], [progress], WEEK_START);
    expect(result.filter((m) => m.type === "budget_pace")).toHaveLength(0);
  });

  // Test 9 — 6+ moves all above threshold → only 3 returned, sorted by impact descending
  it("returns at most 3 moves sorted by impact descending when many moves qualify", () => {
    // Create 6 budget progresses with different categories, all overpaced
    // Use large current-week spend to guarantee all 6 fire pace moves
    // Each category gets a different week spend to produce distinct impacts
    const categories = [
      "food",
      "transport",
      "entertainment",
      "health",
      "utilities",
      "education",
    ] as CategoryId[];

    // Amounts spent this week per category (all → projected > budget of 500_000)
    const weeklyAmounts: CopAmount[] = [
      700_000 as CopAmount, // impact ~1_100_000
      800_000 as CopAmount, // impact ~1_228_571
      600_000 as CopAmount, // impact ~971_428
      900_000 as CopAmount, // impact ~1_357_142
      1_000_000 as CopAmount, // impact ~1_485_714
      1_100_000 as CopAmount, // impact ~1_614_285
    ];

    const txs = categories.map((categoryId, i) =>
      makeTx({
        date: new Date("2026-03-16T12:00:00"),
        categoryId,
        amount: weeklyAmounts[i],
      })
    );

    const progresses = categories.map((categoryId, i) =>
      makeProgress({
        budgetId: `b${i + 1}` as BudgetId,
        categoryId,
        amount: 500_000 as CopAmount,
        spent: 0 as CopAmount,
      })
    );

    const result = deriveWeeklyMoves(txs, progresses, WEEK_START);
    expect(result).toHaveLength(3);

    // Verify sorted by impact descending
    const impacts = result.map((m) => m.impact);
    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
  });

  // Test 11 — boundary: thisWeekSpend === exactly 1.5× median → no anomaly (strict >)
  it("emits no anomaly when this-week spend equals exactly 1.5× the median (boundary)", () => {
    // 5 prior transactions each in its own bucket at 100_000 → median = 100_000
    // 1.5 × 100_000 = 150_000; current week spend = 150_000 (equal, not greater) → no anomaly
    const prior = Array.from({ length: 5 }, (_, i) =>
      makeTx({ date: priorDate(i), amount: 100_000 as CopAmount })
    );
    const currentWeekTx = makeTx({
      date: new Date("2026-03-17T12:00:00"),
      amount: 150_000 as CopAmount,
    });
    const result = deriveWeeklyMoves([...prior, currentWeekTx], [], WEEK_START);
    expect(result.filter((m) => m.type === "anomaly")).toHaveLength(0);
  });

  // Test 12 — weekStart with non-midnight time: early-morning tx on weekStart day → current week
  it("counts a transaction at 6am on weekStart day as current week even when weekStart is noon", () => {
    // weekStart passed as noon; 6am same day should still be current week after normalization
    const weekStartNoon = new Date("2026-03-16T12:00:00");
    const earlyTx = makeTx({
      date: new Date("2026-03-16T06:00:00"), // 6am — before noon weekStart
      amount: 700_000 as CopAmount,
    });
    const progress = makeProgress({ amount: 100_000 as CopAmount, spent: 0 as CopAmount });
    const result = deriveWeeklyMoves([earlyTx], [progress], weekStartNoon);
    // If 6am tx counted as current week: weekDailyRate = 100_000/day → pace fires
    // If wrongly counted as prior: weekDailyRate = 0 → no pace
    expect(result.filter((m) => m.type === "budget_pace")).toHaveLength(1);
  });

  // Test 13 — weekStart with non-midnight time: Sunday evening tx → current week
  it("counts a Sunday evening transaction as current week even when weekStart is noon", () => {
    const weekStartNoon = new Date("2026-03-16T12:00:00");
    const sundayEveningTx = makeTx({
      date: new Date("2026-03-22T20:00:00"), // 8pm Sunday — after Sunday noon (old weekEnd)
      amount: 700_000 as CopAmount,
    });
    const progress = makeProgress({ amount: 100_000 as CopAmount, spent: 0 as CopAmount });
    const result = deriveWeeklyMoves([sundayEveningTx], [progress], weekStartNoon);
    // If Sunday evening counted as current week: pace fires
    // If wrongly excluded: no pace
    expect(result.filter((m) => m.type === "budget_pace")).toHaveLength(1);
  });

  // Test 10 — same category fires both anomaly and pace → both appear (no dedup)
  it("emits both AnomalyMove and BudgetPaceMove for the same category when both conditions are met", () => {
    // 5 prior transactions in "food" at 100_000 each (one per bucket)
    // Current week spend = 200_000 → anomaly (>1.5× median of 100_000)
    // Budget: 500_000 budget, 0 spent
    // projected = (200_000/7) × 16 ≈ 457_142 < 500_000 → NOT a pace alert
    // Let's use 300_000 this-week instead:
    // 300_000 > 1.5 × 100_000 = 150_000 → anomaly ✓
    // projected = (300_000/7) × 16 ≈ 685_714 > 500_000 → pace ✓
    const prior = Array.from({ length: 5 }, (_, i) =>
      makeTx({ date: priorDate(i), amount: 100_000 as CopAmount })
    );
    const currentWeekTx = makeTx({
      date: new Date("2026-03-16T12:00:00"),
      amount: 300_000 as CopAmount,
      categoryId: "food" as CategoryId,
    });
    const progress = makeProgress({
      categoryId: "food" as CategoryId,
      amount: 500_000 as CopAmount,
      spent: 0 as CopAmount,
    });

    const result = deriveWeeklyMoves([...prior, currentWeekTx], [progress], WEEK_START);

    const anomalies = result.filter(isAnomaly);
    const paces = result.filter(isBudgetPace);

    expect(anomalies).toHaveLength(1);
    expect(paces).toHaveLength(1);

    // Verify they both refer to "food"
    expect(anomalies[0]?.categoryId).toBe("food");
    expect(paces[0]?.categoryId).toBe("food");
  });
});
