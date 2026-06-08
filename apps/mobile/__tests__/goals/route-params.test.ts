import { describe, expect, it } from "vitest";
import { resolveGoalDetailGoalId } from "@/features/goals/lib/route-params";

describe("resolveGoalDetailGoalId", () => {
  it("reads the goalId param", () => {
    expect(resolveGoalDetailGoalId({ goalId: "goal_123" })).toBe("goal_123");
  });

  it("reads the first non-empty goalId param", () => {
    expect(resolveGoalDetailGoalId({ goalId: ["   ", "goal_123"] })).toBe("goal_123");
  });

  it("ignores empty params", () => {
    expect(resolveGoalDetailGoalId({ goalId: "   " })).toBeNull();
  });
});
