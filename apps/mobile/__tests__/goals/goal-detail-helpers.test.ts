import { expect, test } from "vitest";
import {
  buildContributionRows,
  buildGoalMilestones,
  buildGoalProjectionCopy,
  buildGoalRecommendationCopy,
  checkMilestoneCrossed,
  getNextGoalMilestoneState,
} from "@/features/goals/components/goal-detail/GoalDetail.helpers";

const contributionRowsInput = [
  {
    id: "c-3",
    goalId: "goal-1",
    userId: "user-1",
    amount: 30000,
    note: null,
    date: "2026-04-20",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "c-2",
    goalId: "goal-1",
    userId: "user-1",
    amount: 20000,
    note: null,
    date: "2026-04-10",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "c-1",
    goalId: "goal-1",
    userId: "user-1",
    amount: 10000,
    note: null,
    date: "2026-04-01",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    deletedAt: null,
  },
];

const goalDetailGoalFixture = {
  goal: {
    id: "goal-b",
    userId: "user-1",
    name: "Trip",
    type: "savings" as const,
    targetAmount: 900000,
    targetDate: null,
    interestRatePercent: null,
    iconName: null,
    colorHex: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  },
  currentAmount: 300000,
  progress: {
    percentComplete: 30,
    remaining: 600000,
    isComplete: false,
  },
  projection: {
    projectedDate: new Date("2026-11-01T12:00:00.000Z"),
    monthsToGo: 7,
    confidence: "medium" as const,
    netMonthlySavings: 45000,
  },
  installments: {
    current: 2,
    total: 14,
  },
  paceGuidance: null,
};

test("returns the highest milestone crossed between two percentages", () => {
  expect(checkMilestoneCrossed(24, 76)).toBe(75);
  expect(checkMilestoneCrossed(76, 80)).toBeNull();
});

test("builds running totals while preserving reverse-chronological contribution order", () => {
  expect(buildContributionRows(contributionRowsInput)).toEqual([
    { contribution: contributionRowsInput[0], runningTotal: 60000 },
    { contribution: contributionRowsInput[1], runningTotal: 30000 },
    { contribution: contributionRowsInput[2], runningTotal: 10000 },
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

test("resets the milestone baseline when the viewed goal changes", () => {
  expect(
    getNextGoalMilestoneState({ goalId: "goal-a", percent: 80 }, goalDetailGoalFixture)
  ).toEqual({
    baseline: { goalId: "goal-b", percent: 30 },
    crossedMilestone: null,
  });
});

test("builds projection copy without rendering null months", () => {
  expect(
    buildGoalProjectionCopy({
      projectedDate: null,
      monthsToGo: null,
      confidence: "low",
      netMonthlySavings: 45000,
    })
  ).toEqual({
    key: "goals.detail.setTargetDate",
  });
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
