import type {
  GoalPaceGuidance,
  GoalProgress,
  GoalProjection,
  InstallmentProgress,
} from "./lib/derive";
import type { Goal } from "./schema";

export type GoalWithProgress = {
  readonly goal: Goal;
  readonly currentAmount: number;
  readonly progress: GoalProgress;
  readonly projection: GoalProjection;
  readonly installments: InstallmentProgress;
  readonly paceGuidance: GoalPaceGuidance | null;
};
