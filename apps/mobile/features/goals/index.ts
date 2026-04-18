export { AddPaymentSheet } from "./components/AddPaymentSheet";
export type { CelebrationMilestone } from "./components/CelebrationModal";
export { CelebrationModal } from "./components/CelebrationModal";
export { GoalCard } from "./components/GoalCard";
export { GoalCreateSheet } from "./components/GoalCreateSheet";
export { GoalDetailScreen } from "./components/GoalDetail";
export { GoalEditSheet } from "./components/GoalEditSheet";
export { GoalSmartCard } from "./components/GoalSmartCard";
export { GoalsListScreen } from "./components/GoalsListScreen";
export type {
  BudgetNudge,
  ConfidenceTier,
  GoalAlert,
  GoalPaceGuidance,
  GoalProgress,
  GoalProjection,
  InstallmentProgress,
  Milestone,
  MonthlyTotal,
} from "./lib/derive";
export {
  computeMedian,
  deriveBudgetNudges,
  deriveDebtProjection,
  deriveGoalAlerts,
  deriveGoalPaceGuidance,
  deriveGoalProgress,
  deriveGoalProjection,
  deriveInstallmentProgress,
  deriveMonthlyMilestones,
} from "./lib/derive";
export type { GoalContributionRow, GoalRow } from "./lib/repository";
export {
  getContributionById,
  getContributionMonthCount,
  getContributionsForGoal,
  getGoalById,
  getGoalCurrentAmount,
  getGoalsForUser,
  insertContribution,
  insertGoal,
  softDeleteContribution,
  softDeleteGoal,
  updateGoal,
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
export {
  initializeGoalSession,
  loadGoalsForUser,
  selectGoal,
  useGoalStore,
} from "./store";
export type { GoalWithProgress } from "./types";
