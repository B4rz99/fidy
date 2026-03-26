import { describe, expect, it } from "vitest";
import {
  deriveDigestMessage,
  type WeeklyDigestData,
} from "../../../../supabase/functions/_shared/derive-digest";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeData = (overrides: Partial<WeeklyDigestData> = {}): WeeklyDigestData => ({
  totalSpent: 1_500_000,
  topCategories: [
    { name: "Food", amount: 800_000 },
    { name: "Transport", amount: 400_000 },
  ],
  budgetStatus: "on_track",
  goalContributionsThisWeek: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deriveDigestMessage", () => {
  // Test 1 — Basic digest with spending and top categories
  it("produces title and body with spending and top categories", () => {
    const result = deriveDigestMessage(makeData());
    expect(result.title).toBe("Your Week in Review");
    expect(result.body).toContain("You spent $1.500.000 this week");
    expect(result.body).toContain("mostly on Food and Transport");
  });

  // Test 2 — Over budget message
  it("includes over-budget warning when budgetStatus is over", () => {
    const result = deriveDigestMessage(makeData({ budgetStatus: "over" }));
    expect(result.body).toContain("over budget");
  });

  // Test 3 — On track message
  it("includes on-track message when budgetStatus is on_track", () => {
    const result = deriveDigestMessage(makeData({ budgetStatus: "on_track" }));
    expect(result.body).toContain("on track");
  });

  // Test 4 — No budgets message
  it("omits budget status text when budgetStatus is no_budgets", () => {
    const result = deriveDigestMessage(makeData({ budgetStatus: "no_budgets" }));
    expect(result.body).not.toContain("on track");
    expect(result.body).not.toContain("over budget");
  });

  // Test 5 — With goal contributions
  it("includes goal savings when goalContributionsThisWeek > 0", () => {
    const result = deriveDigestMessage(makeData({ goalContributionsThisWeek: 250_000 }));
    expect(result.body).toContain("saved $250.000");
    expect(result.body).toContain("goals");
  });

  // Test 6 — Zero spending
  it("handles zero spending gracefully", () => {
    const result = deriveDigestMessage(makeData({ totalSpent: 0, topCategories: [] }));
    expect(result.title).toBe("Your Week in Review");
    expect(result.body).toContain("You spent $0 this week");
  });

  // Test 7 — Body stays under 200 characters
  it("keeps body under 200 characters", () => {
    const result = deriveDigestMessage(
      makeData({
        totalSpent: 99_999_999,
        topCategories: [
          { name: "Entertainment & Recreation", amount: 50_000_000 },
          { name: "Restaurants & Dining Out", amount: 30_000_000 },
        ],
        budgetStatus: "over",
        goalContributionsThisWeek: 10_000_000,
      })
    );
    expect(result.body.length).toBeLessThanOrEqual(200);
  });

  // Test 8 — Single top category uses only that name
  it("uses single category name when only one top category exists", () => {
    const result = deriveDigestMessage(
      makeData({
        topCategories: [{ name: "Food", amount: 800_000 }],
      })
    );
    expect(result.body).toContain("mostly on Food");
    expect(result.body).not.toContain(" and ");
  });

  // Test 9 — No goal contributions omits goal text
  it("omits goal text when goalContributionsThisWeek is 0", () => {
    const result = deriveDigestMessage(makeData({ goalContributionsThisWeek: 0 }));
    expect(result.body).not.toContain("saved");
    expect(result.body).not.toContain("goals");
  });
});
