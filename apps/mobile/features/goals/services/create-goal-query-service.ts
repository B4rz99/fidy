import { getMonthlyTotalsByType } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import type { UserId } from "@/shared/types/branded";
import {
  deriveDebtProjection,
  deriveGoalPaceGuidance,
  deriveGoalProgress,
  deriveGoalProjection,
  deriveInstallmentProgress,
  type MonthlyTotal,
} from "../lib/derive";
import {
  getContributionMonthCount,
  getContributionsForGoal,
  getGoalCurrentAmount,
  getGoalsForUser,
} from "../lib/repository";
import type { Goal, GoalContribution } from "../schema";
import type { GoalWithProgress } from "../types";

type LoadGoalsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
};

type LoadGoalContributionsInput = {
  readonly db: AnyDb;
  readonly goalId: string;
};

type GoalQueryServiceDeps = {
  readonly getGoalsForUser?: typeof getGoalsForUser;
  readonly getGoalCurrentAmount?: typeof getGoalCurrentAmount;
  readonly getMonthlyTotalsByType?: typeof getMonthlyTotalsByType;
  readonly getContributionMonthCount?: typeof getContributionMonthCount;
  readonly getContributionsForGoal?: typeof getContributionsForGoal;
  readonly getToday?: () => Date;
};

function getGoalPaceGuidance(input: {
  readonly goal: Goal;
  readonly currentAmount: number;
  readonly contributionMonths: number;
  readonly today: Date;
}) {
  return deriveGoalPaceGuidance(
    input.goal,
    input.currentAmount,
    input.contributionMonths > 0,
    input.today
  );
}

function toGoalWithProgress(
  goal: Goal,
  currentAmount: number,
  monthlyTotals: readonly MonthlyTotal[],
  contributionMonths: number,
  today: Date
): GoalWithProgress {
  const progress = deriveGoalProgress(goal, currentAmount);
  const savingsProjection = deriveGoalProjection(goal, currentAmount, monthlyTotals);
  const paceGuidance = getGoalPaceGuidance({
    goal,
    currentAmount,
    contributionMonths,
    today,
  });
  const projection =
    goal.type === "debt" &&
    goal.interestRatePercent != null &&
    savingsProjection.netMonthlySavings > 0
      ? (() => {
          const debtProjection = deriveDebtProjection(
            goal,
            currentAmount,
            savingsProjection.netMonthlySavings
          );
          if (debtProjection.status === "ok" || debtProjection.status === "zero_rate") {
            return {
              projectedDate: debtProjection.projectedDate,
              monthsToGo: debtProjection.monthsToGo,
              confidence: savingsProjection.confidence,
              netMonthlySavings: savingsProjection.netMonthlySavings,
            };
          }
          if (debtProjection.status === "payment_too_low") {
            return {
              projectedDate: null,
              monthsToGo: null,
              confidence: savingsProjection.confidence,
              netMonthlySavings: savingsProjection.netMonthlySavings,
            };
          }
          return savingsProjection;
        })()
      : savingsProjection;

  return {
    goal,
    currentAmount,
    progress,
    projection,
    installments: deriveInstallmentProgress(
      goal.targetAmount,
      projection.netMonthlySavings,
      contributionMonths
    ),
    paceGuidance,
  };
}

export function createGoalQueryService({
  getGoalsForUser: loadGoals = getGoalsForUser,
  getGoalCurrentAmount: loadGoalCurrentAmount = getGoalCurrentAmount,
  getMonthlyTotalsByType: loadMonthlyTotals = getMonthlyTotalsByType,
  getContributionMonthCount: countContributionMonths = getContributionMonthCount,
  getContributionsForGoal: loadContributions = getContributionsForGoal,
  getToday = () => new Date(),
}: GoalQueryServiceDeps = {}) {
  return {
    loadGoals: async ({ db, userId }: LoadGoalsInput): Promise<readonly GoalWithProgress[]> => {
      const goals = loadGoals(db, userId) as Goal[];
      const monthlyTotals = loadMonthlyTotals(db, userId, 3) as readonly MonthlyTotal[];
      const today = getToday();

      return goals.map((goal) =>
        toGoalWithProgress(
          goal,
          loadGoalCurrentAmount(db, goal.id),
          monthlyTotals,
          countContributionMonths(db, goal.id),
          today
        )
      );
    },

    loadGoalContributions: async ({
      db,
      goalId,
    }: LoadGoalContributionsInput): Promise<readonly GoalContribution[]> =>
      loadContributions(db, goalId) as GoalContribution[],
  };
}
