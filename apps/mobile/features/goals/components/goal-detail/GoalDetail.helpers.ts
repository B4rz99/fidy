import { format } from "date-fns";
import { formatMoney } from "@/shared/lib";
import type { GoalProjection, Milestone } from "../../lib/derive";
import { deriveMonthlyMilestones } from "../../lib/derive";
import type { GoalContribution } from "../../schema";
import type { GoalWithProgress } from "../../types";
import type { CelebrationMilestone } from "../CelebrationModal";

export type TabType = "contributions" | "aiPlan";

export type ContributionWithRunning = {
  readonly contribution: GoalContribution;
  readonly runningTotal: number;
};

export type GoalRecommendationCopy =
  | {
      readonly key: "goals.detail.recommendationText";
      readonly values: {
        readonly amount: string;
        readonly date: string;
      };
    }
  | {
      readonly key: "goals.detail.recommendationTextNoDate";
      readonly values: {
        readonly amount: string;
      };
    };

export type GoalProjectionCopy =
  | { readonly key: "goals.detail.setTargetDate" }
  | { readonly key: "goals.detail.spendingExceedsIncome" }
  | {
      readonly key: "goals.detail.roughEstimate";
      readonly values: {
        readonly months: string;
      };
    }
  | {
      readonly key: "goals.detail.estimated";
      readonly values: {
        readonly date: string;
      };
    };

export type GoalMilestoneBaseline = {
  readonly goalId: string | null;
  readonly percent: number | null;
};

export type GoalMilestoneState = {
  readonly baseline: GoalMilestoneBaseline;
  readonly crossedMilestone: CelebrationMilestone | null;
};

const MILESTONE_THRESHOLDS: readonly CelebrationMilestone[] = [25, 50, 75, 100];
const EMPTY_GOAL_MILESTONE_BASELINE: GoalMilestoneBaseline = { goalId: null, percent: null };

export function checkMilestoneCrossed(
  previousPercent: number,
  currentPercent: number
): CelebrationMilestone | null {
  return MILESTONE_THRESHOLDS.reduce<CelebrationMilestone | null>(
    (crossed, threshold) =>
      previousPercent < threshold && currentPercent >= threshold ? threshold : crossed,
    null
  );
}

export function buildContributionRows(
  contributions: readonly GoalContribution[]
): readonly ContributionWithRunning[] {
  const rows: ContributionWithRunning[] = [];

  contributions.reduceRight((runningTotal, contribution) => {
    const nextTotal = runningTotal + contribution.amount;
    rows.unshift({ contribution, runningTotal: nextTotal });
    return nextTotal;
  }, 0);

  return rows;
}

export function buildGoalMilestones(
  currentAmount: number,
  projection: GoalProjection
): readonly Milestone[] {
  return projection.monthsToGo != null && projection.netMonthlySavings > 0
    ? deriveMonthlyMilestones(
        currentAmount,
        projection.netMonthlySavings,
        Math.min(projection.monthsToGo, 12)
      )
    : [];
}

export function buildGoalRecommendationCopy(projection: GoalProjection): GoalRecommendationCopy {
  const amount = formatMoney(Math.round(projection.netMonthlySavings));

  return projection.projectedDate != null
    ? {
        key: "goals.detail.recommendationText",
        values: {
          amount,
          date: format(projection.projectedDate, "MMMM yyyy"),
        },
      }
    : {
        key: "goals.detail.recommendationTextNoDate",
        values: { amount },
      };
}

function buildLowConfidenceProjectionCopy(projection: GoalProjection): GoalProjectionCopy {
  return projection.monthsToGo == null
    ? { key: "goals.detail.setTargetDate" }
    : {
        key: "goals.detail.roughEstimate",
        values: { months: String(projection.monthsToGo) },
      };
}

function buildEstimatedProjectionCopy(projection: GoalProjection): GoalProjectionCopy {
  return {
    key: "goals.detail.estimated",
    values: {
      date: projection.projectedDate ? format(projection.projectedDate, "MMMM yyyy") : "",
    },
  };
}

function buildGoalMilestoneBaseline(goalData: GoalWithProgress): GoalMilestoneBaseline {
  return {
    goalId: goalData.goal.id,
    percent: goalData.progress.percentComplete,
  };
}

function getGoalMilestoneCrossing(
  baseline: GoalMilestoneBaseline,
  nextBaseline: GoalMilestoneBaseline
): CelebrationMilestone | null {
  return baseline.percent != null && baseline.percent !== nextBaseline.percent
    ? checkMilestoneCrossed(baseline.percent, nextBaseline.percent ?? 0)
    : null;
}

export function getNextGoalMilestoneState(
  baseline: GoalMilestoneBaseline,
  goalData: GoalWithProgress | null
): GoalMilestoneState {
  if (goalData == null) {
    return {
      baseline: EMPTY_GOAL_MILESTONE_BASELINE,
      crossedMilestone: null,
    };
  }

  const nextBaseline = buildGoalMilestoneBaseline(goalData);

  return baseline.goalId !== goalData.goal.id
    ? {
        baseline: nextBaseline,
        crossedMilestone: null,
      }
    : {
        baseline: nextBaseline,
        crossedMilestone: getGoalMilestoneCrossing(baseline, nextBaseline),
      };
}

export function buildGoalProjectionCopy(projection: GoalProjection): GoalProjectionCopy {
  if (projection.confidence === "none") {
    return { key: "goals.detail.setTargetDate" };
  }

  if (projection.netMonthlySavings <= 0) {
    return { key: "goals.detail.spendingExceedsIncome" };
  }

  return projection.confidence === "low"
    ? buildLowConfidenceProjectionCopy(projection)
    : buildEstimatedProjectionCopy(projection);
}

export function hasLowConfidenceProjection(projection: GoalProjection): boolean {
  return projection.confidence === "low" && projection.netMonthlySavings > 0;
}
