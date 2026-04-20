import { describe, expect, it } from "vitest";
import { resolveGoalDetailGoalId } from "@/features/goals/lib/route-params";

describe("resolveGoalDetailGoalId", () => {
  it("prefers the normalized goalId param", () => {
    expect(resolveGoalDetailGoalId({ goalId: "goal_123", id: "legacy_goal" })).toBe("goal_123");
  });

  it("falls back to the legacy id param", () => {
    expect(resolveGoalDetailGoalId({ id: "legacy_goal" })).toBe("legacy_goal");
  });

  it("ignores empty params", () => {
    expect(resolveGoalDetailGoalId({ goalId: "   ", id: "" })).toBeNull();
  });
});
