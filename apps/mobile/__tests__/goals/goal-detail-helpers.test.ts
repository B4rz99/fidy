import { expect, test } from "vitest";
import {
  buildContributionRows,
  buildGoalMilestones,
  buildGoalRecommendationCopy,
  checkMilestoneCrossed,
} from "@/features/goals/components/goal-detail/GoalDetail.helpers";
import type { GoalContribution } from "@/features/goals/schema";

function createContribution(id: string, amount: number, date: string): GoalContribution {
  return {
    id,
    goalId: "goal-1",
    userId: "user-1",
    amount,
    note: null,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    deletedAt: null,
  };
}

test("returns the highest milestone crossed between two percentages", () => {
  expect(checkMilestoneCrossed(24, 76)).toBe(75);
  expect(checkMilestoneCrossed(76, 80)).toBeNull();
});

test("builds running totals while preserving reverse-chronological contribution order", () => {
  const contributions = [
    createContribution("c-3", 30000, "2026-04-20"),
    createContribution("c-2", 20000, "2026-04-10"),
    createContribution("c-1", 10000, "2026-04-01"),
  ];

  expect(buildContributionRows(contributions)).toEqual([
    { contribution: contributions[0], runningTotal: 60000 },
    { contribution: contributions[1], runningTotal: 30000 },
    { contribution: contributions[2], runningTotal: 10000 },
  ]);
});

test("caps AI-plan milestones at twelve months", () => {
  const milestones = buildGoalMilestones(200000, {
    projectedDate: new Date("2027-09-01T12:00:00.000Z"),
    monthsToGo: 18,
    confidence: "high",
    netMonthlySavings: 50000,
  });

  expect(milestones).toHaveLength(12);
});

test("builds recommendation copy for dated and undated projections", () => {
  expect(
    buildGoalRecommendationCopy({
      projectedDate: new Date("2026-11-01T12:00:00.000Z"),
      monthsToGo: 7,
      confidence: "medium",
      netMonthlySavings: 45000,
    })
  ).toEqual({
    key: "goals.detail.recommendationText",
    values: {
      amount: "$45.000",
      date: "November 2026",
    },
  });

  expect(
    buildGoalRecommendationCopy({
      projectedDate: null,
      monthsToGo: null,
      confidence: "none",
      netMonthlySavings: 0,
    })
  ).toEqual({
    key: "goals.detail.recommendationTextNoDate",
    values: {
      amount: "$0",
    },
  });
});
