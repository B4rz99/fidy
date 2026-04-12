import { create } from "zustand";
import { scheduleLocalPush, useNotificationStore } from "@/features/notifications";
import { getMonthlyTotalsByType, useTransactionStore } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { i18n } from "@/shared/i18n";
import {
  generateId,
  toIsoDateTime,
  trackGoalContributionAdded,
  trackGoalCreated,
  trackGoalMilestoneReached,
} from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { createWriteThroughMutationModule, type WriteThroughMutationModule } from "@/shared/mutations";

// Import from goals feature
import type {
  GoalPaceGuidance,
  GoalProgress,
  GoalProjection,
  InstallmentProgress,
} from "./lib/derive";
import {
  deriveDebtProjection,
  deriveGoalPaceGuidance,
  deriveGoalProgress,
  deriveGoalProjection,
  deriveInstallmentProgress,
} from "./lib/derive";
import {
  getContributionMonthCount,
  getContributionsForGoal,
  getGoalCurrentAmount,
  getGoalsForUser,
} from "./lib/repository";
import type { Goal, GoalContribution } from "./schema";
import { addContributionSchema, createGoalSchema } from "./schema";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;
let unsubscribeTxStore: (() => void) | null = null;
let mutations: WriteThroughMutationModule | null = null;

export type GoalWithProgress = {
  readonly goal: Goal;
  readonly currentAmount: number;
  readonly progress: GoalProgress;
  readonly projection: GoalProjection;
  readonly installments: InstallmentProgress;
  readonly paceGuidance: GoalPaceGuidance | null;
};

type GoalState = {
  goals: GoalWithProgress[];
  selectedGoalId: string | null;
  selectedGoalContributions: GoalContribution[];
  isLoading: boolean;
};

type GoalActions = {
  initStore: (db: AnyDb, userId: string) => void;
  loadGoals: () => Promise<void>;
  loadGoalContributions: (goalId: string) => void;
  createGoal: (input: {
    name: string;
    type: "savings" | "debt";
    targetAmount: number;
    targetDate?: string;
    interestRatePercent?: number;
    iconName?: string;
    colorHex?: string;
  }) => Promise<boolean>;
  updateGoal: (
    id: string,
    data: {
      name?: string;
      targetAmount?: number;
      targetDate?: string | null;
      interestRatePercent?: number | null;
      iconName?: string | null;
      colorHex?: string | null;
    }
  ) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addContribution: (input: {
    goalId: string;
    amount: number;
    note?: string;
    date: string;
  }) => Promise<boolean>;
  deleteContribution: (id: string) => Promise<void>;
  selectGoal: (goalId: string | null) => void;
  refreshProjections: () => void;
};

export const useGoalStore = create<GoalState & GoalActions>((set, get) => ({
  goals: [],
  selectedGoalId: null,
  selectedGoalContributions: [],
  isLoading: false,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    mutations = createWriteThroughMutationModule(db);
    // Subscribe to transaction store changes to auto-refresh projections
    if (unsubscribeTxStore) unsubscribeTxStore();
    unsubscribeTxStore = useTransactionStore.subscribe(() => {
      if (get().goals.length > 0) {
        get().refreshProjections();
      }
    });
  },

  loadGoals: async () => {
    const db = dbRef;
    if (!db || !userIdRef) return;
    set({ isLoading: true });
    try {
      const goalRows = getGoalsForUser(db, userIdRef) as Goal[];
      const monthlyTotals = getMonthlyTotalsByType(db, userIdRef as UserId, 3);

      const goalsWithProgress: GoalWithProgress[] = goalRows.map((goal) => {
        const currentAmount = getGoalCurrentAmount(db, goal.id);
        const progress = deriveGoalProgress(goal, currentAmount);
        const savingsProjection = deriveGoalProjection(goal, currentAmount, monthlyTotals);

        // For debt goals with interest, use amortization-based projection
        const projection: GoalProjection =
          goal.type === "debt" &&
          goal.interestRatePercent != null &&
          savingsProjection.netMonthlySavings > 0
            ? (() => {
                const debtResult = deriveDebtProjection(
                  goal,
                  currentAmount,
                  savingsProjection.netMonthlySavings
                );
                if (debtResult.status === "ok" || debtResult.status === "zero_rate") {
                  return {
                    projectedDate: debtResult.projectedDate,
                    monthsToGo: debtResult.monthsToGo,
                    confidence: savingsProjection.confidence,
                    netMonthlySavings: savingsProjection.netMonthlySavings,
                  };
                }
                if (debtResult.status === "payment_too_low") {
                  return {
                    projectedDate: null,
                    monthsToGo: null,
                    confidence: savingsProjection.confidence,
                    netMonthlySavings: savingsProjection.netMonthlySavings,
                  };
                }
                // complete — fall back to savings projection
                return savingsProjection;
              })()
            : savingsProjection;

        const contributionMonths = getContributionMonthCount(db, goal.id);
        const installments = deriveInstallmentProgress(
          goal.targetAmount,
          projection.netMonthlySavings,
          contributionMonths
        );
        const paceGuidance = deriveGoalPaceGuidance(goal, currentAmount, contributionMonths > 0);
        return { goal, currentAmount, progress, projection, installments, paceGuidance };
      });

      set({ goals: goalsWithProgress, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadGoalContributions: (goalId) => {
    if (!dbRef) return;
    try {
      const contributions = getContributionsForGoal(dbRef, goalId) as GoalContribution[];
      set({ selectedGoalContributions: contributions, selectedGoalId: goalId });
    } catch {
      // keep existing state
    }
  },

  createGoal: async (input) => {
    if (!dbRef || !userIdRef) return false;
    const validation = createGoalSchema.safeParse(input);
    if (!validation.success) return false;
    const mutationModule = mutations;
    if (!mutationModule) return false;
    const now = toIsoDateTime(new Date());
    const id = generateId("gl");
    try {
      const result = await mutationModule.commit({
        kind: "goal.save",
        row: {
          id,
          userId: userIdRef,
          name: input.name,
          type: input.type,
          targetAmount: input.targetAmount,
          targetDate: input.targetDate ?? null,
          interestRatePercent: input.interestRatePercent ?? null,
          iconName: input.iconName ?? null,
          colorHex: input.colorHex ?? null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      });
      if (!result.success) return false;
    } catch {
      return false;
    }
    trackGoalCreated();
    await get().loadGoals();
    return true;
  },

  updateGoal: async (id, data) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    const now = toIsoDateTime(new Date());
    try {
      const result = await mutationModule.commit({
        kind: "goal.update",
        goalId: id,
        data,
        now,
      });
      if (!result.success) return;
    } catch {
      return;
    }
    await get().loadGoals();
  },

  deleteGoal: async (id) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    const now = toIsoDateTime(new Date());
    try {
      const result = await mutationModule.commit({
        kind: "goal.delete",
        goalId: id,
        now,
      });
      if (!result.success) return;
    } catch {
      return;
    }
    if (get().selectedGoalId === id) {
      set({ selectedGoalId: null, selectedGoalContributions: [] });
    }
    await get().loadGoals();
  },

  addContribution: async (input) => {
    if (!dbRef || !userIdRef) return false;
    const validation = addContributionSchema.safeParse(input);
    if (!validation.success) return false;
    const mutationModule = mutations;
    if (!mutationModule) return false;
    const now = toIsoDateTime(new Date());
    const id = generateId("gc");
    try {
      const result = await mutationModule.commit({
        kind: "goalContribution.save",
        row: {
          id,
          goalId: input.goalId,
          userId: userIdRef,
          amount: input.amount,
          note: input.note ?? null,
          date: input.date,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      });
      if (!result.success) return false;
    } catch {
      return false;
    }
    trackGoalContributionAdded();
    const goalBefore = get().goals.find((g) => g.goal.id === input.goalId);
    const percentBefore = goalBefore?.progress.percentComplete ?? 0;

    await get().loadGoals();

    // Detect goal milestone crossings — only fire for NEWLY crossed milestones
    const goalAfter = get().goals.find((g) => g.goal.id === input.goalId);
    if (goalAfter) {
      const percentAfter = goalAfter.progress.percentComplete;
      const milestones = [25, 50, 75, 100] as const;
      milestones.forEach((milestone) => {
        if (percentBefore < milestone && percentAfter >= milestone) {
          useNotificationStore.getState().insertNotification({
            type: "goal_milestone",
            dedupKey: `goal_milestone:${input.goalId}:${milestone}`,
            categoryId: null,
            goalId: input.goalId,
            titleKey: "notifications.goalMilestone",
            messageKey: "notifications.goalMilestoneMsg",
            params: JSON.stringify({
              goalName: goalAfter.goal.name,
              percent: milestone,
            }),
          });
          trackGoalMilestoneReached();

          // Best-effort local push (preference guard inside scheduleLocalPush)
          scheduleLocalPush({
            title: i18n.t("notifications.goalMilestone", {
              goalName: goalAfter.goal.name,
              percent: milestone,
            }),
            body: i18n.t("notifications.goalMilestoneMsg", { percent: milestone }),
            data: { route: `/goal-detail?id=${input.goalId}` },
            preferenceKey: "goalMilestones",
          }).catch(() => {});
        }
      });
    }

    // Refresh contributions if viewing this goal
    if (get().selectedGoalId === input.goalId) {
      get().loadGoalContributions(input.goalId);
    }
    return true;
  },

  deleteContribution: async (id) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    const now = toIsoDateTime(new Date());
    try {
      const result = await mutationModule.commit({
        kind: "goalContribution.delete",
        contributionId: id,
        now,
      });
      if (!result.success) return;
    } catch {
      return;
    }
    await get().loadGoals();
    // Refresh contributions if a goal is selected
    const selectedId = get().selectedGoalId;
    if (selectedId) {
      get().loadGoalContributions(selectedId);
    }
  },

  selectGoal: (goalId) => {
    set({ selectedGoalId: goalId });
    if (goalId && dbRef) {
      get().loadGoalContributions(goalId);
    } else {
      set({ selectedGoalContributions: [] });
    }
  },

  refreshProjections: () => {
    const db = dbRef;
    if (!db || !userIdRef) return;
    try {
      const monthlyTotals = getMonthlyTotalsByType(db, userIdRef as UserId, 3);
      const { goals } = get();
      const updated = goals.map((g) => {
        const currentAmount = getGoalCurrentAmount(db, g.goal.id);
        const progress = deriveGoalProgress(g.goal, currentAmount);
        const savingsProj = deriveGoalProjection(g.goal, currentAmount, monthlyTotals);

        const projection: GoalProjection =
          g.goal.type === "debt" &&
          g.goal.interestRatePercent != null &&
          savingsProj.netMonthlySavings > 0
            ? (() => {
                const dr = deriveDebtProjection(
                  g.goal,
                  currentAmount,
                  savingsProj.netMonthlySavings
                );
                if (dr.status === "ok" || dr.status === "zero_rate") {
                  return {
                    projectedDate: dr.projectedDate,
                    monthsToGo: dr.monthsToGo,
                    confidence: savingsProj.confidence,
                    netMonthlySavings: savingsProj.netMonthlySavings,
                  };
                }
                if (dr.status === "payment_too_low") {
                  return {
                    projectedDate: null,
                    monthsToGo: null,
                    confidence: savingsProj.confidence,
                    netMonthlySavings: savingsProj.netMonthlySavings,
                  };
                }
                return savingsProj;
              })()
            : savingsProj;

        const contributionMonths = getContributionMonthCount(db, g.goal.id);
        const installments = deriveInstallmentProgress(
          g.goal.targetAmount,
          projection.netMonthlySavings,
          contributionMonths
        );
        const paceGuidance = deriveGoalPaceGuidance(g.goal, currentAmount, contributionMonths > 0);
        return { goal: g.goal, currentAmount, progress, projection, installments, paceGuidance };
      });
      set({ goals: updated });
    } catch {
      // keep existing state
    }
  },
}));
