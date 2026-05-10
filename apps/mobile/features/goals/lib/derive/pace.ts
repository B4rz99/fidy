import { differenceInDays } from "date-fns";
import { parseIsoDate } from "@/shared/lib";
import { requireIsoDate } from "@/shared/types/assertions";
import type { CopAmount } from "@/shared/types/branded";
import type { GoalCardStatus, GoalPaceGuidance, GoalProgress } from "./types";

export function deriveGoalPaceGuidance(
  goal: {
    readonly targetAmount: number;
    readonly targetDate: string | null;
    readonly createdAt: string;
  },
  currentAmount: number,
  hasContributions: boolean,
  today: Date = new Date()
): GoalPaceGuidance | null {
  if (currentAmount >= goal.targetAmount) return null;
  if (goal.targetDate === null) return null;
  if (!hasContributions) {
    return { type: "pace_behind", amountBehind: 0 as CopAmount, reason: "no_contributions" };
  }

  const start = parseIsoDate(requireIsoDate(goal.createdAt.slice(0, 10)));
  const end = parseIsoDate(requireIsoDate(goal.targetDate));
  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return null;

  const elapsedDays = Math.max(0, Math.min(differenceInDays(today, start), totalDays));
  const expectedNow = goal.targetAmount * (elapsedDays / totalDays);
  const delta = currentAmount - expectedNow;

  return delta >= 0
    ? { type: "pace_ahead", amountAhead: Math.round(delta) as CopAmount }
    : {
        type: "pace_behind",
        amountBehind: Math.round(-delta) as CopAmount,
        reason: "below_pace",
      };
}

export function deriveGoalCardStatus(
  progress: GoalProgress,
  paceGuidance: GoalPaceGuidance | null
): GoalCardStatus | null {
  const progressStatus = getProgressStatus(progress);
  if (progressStatus?.kind === "completed") return progressStatus;
  if (paceGuidance !== null) return getPaceStatus(paceGuidance);
  return progressStatus;
}

const getProgressStatus = (progress: GoalProgress): GoalCardStatus | null => {
  if (progress.isComplete) return { kind: "completed" };
  if (progress.percentComplete >= 75) return { kind: "almost_there" };
  return null;
};

const getPaceStatus = (paceGuidance: GoalPaceGuidance): GoalCardStatus => {
  if (paceGuidance.type === "pace_ahead") {
    return { kind: "pace_ahead", amount: paceGuidance.amountAhead };
  }

  if (paceGuidance.reason === "no_contributions") return { kind: "start_saving" };

  return { kind: "pace_behind", amount: paceGuidance.amountBehind };
};
