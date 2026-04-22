import { format } from "date-fns";
import { formatMoney } from "@/shared/lib";
import type { GoalProjection, Milestone } from "../../lib/derive";
import { deriveMonthlyMilestones } from "../../lib/derive";
import type { GoalContribution } from "../../schema";
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

const MILESTONE_THRESHOLDS: readonly CelebrationMilestone[] = [25, 50, 75, 100];

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

export function buildGoalProjectionCopy(projection: GoalProjection): GoalProjectionCopy {
  if (projection.confidence === "none") {
    return { key: "goals.detail.setTargetDate" };
  }

  if (projection.netMonthlySavings <= 0) {
    return { key: "goals.detail.spendingExceedsIncome" };
  }

  return projection.confidence === "low"
    ? {
        key: "goals.detail.roughEstimate",
        values: { months: String(projection.monthsToGo) },
      }
    : {
        key: "goals.detail.estimated",
        values: {
          date: projection.projectedDate ? format(projection.projectedDate, "MMMM yyyy") : "",
        },
      };
}

export function hasLowConfidenceProjection(projection: GoalProjection): boolean {
  return projection.confidence === "low" && projection.netMonthlySavings > 0;
}
