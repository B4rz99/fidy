export type {
  ConfidenceTier,
  GoalPaceGuidance,
  GoalProgress,
  GoalProjection,
  InstallmentProgress,
  Milestone,
  MonthlyTotal,
} from "./lib/derive";
export {
  computeMedian,
  deriveDebtProjection,
  deriveGoalPaceGuidance,
  deriveGoalProgress,
  deriveGoalProjection,
  deriveInstallmentProgress,
  deriveMonthlyMilestones,
} from "./lib/derive";
export type { GoalContributionRow, GoalRow } from "./lib/repository";
export {
  getContributionMonthCount,
  getContributionsForGoal,
  getGoalCurrentAmount,
  getGoalsForUser,
} from "./lib/repository";
export type {
  AddContributionInput,
  CreateGoalInput,
  Goal,
  GoalContribution,
  GoalType,
} from "./schema";
export { addContributionSchema, createGoalSchema } from "./schema";
export { createGoalQueryService } from "./services/create-goal-query-service";
export { subscribeGoalsToTransactions } from "./services/subscribe-goals-to-transactions";
export { initializeGoalSession, loadGoalsForUser, selectGoal, useGoalStore } from "./store";
export type { GoalWithProgress } from "./types";
