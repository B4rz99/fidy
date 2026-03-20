import { create } from "zustand";
import { useTransactionStore } from "@/features/transactions";
import { getMonthlyTotalsByType } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { generateId } from "@/shared/lib";

// Import from goals feature
import type { GoalProgress, GoalProjection, InstallmentProgress } from "./lib/derive";
import {
  deriveDebtProjection,
  deriveGoalProgress,
  deriveGoalProjection,
  deriveInstallmentProgress,
} from "./lib/derive";
import {
  getContributionMonthCount,
  getContributionsForGoal,
  getGoalCurrentAmount,
  getGoalsForUser,
  insertContribution,
  insertGoal,
  softDeleteContribution,
  softDeleteGoal,
  updateGoal,
} from "./lib/repository";
import type { Goal, GoalContribution } from "./schema";
import { addContributionSchema, createGoalSchema } from "./schema";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;
let unsubscribeTxStore: (() => void) | null = null;

export type GoalWithProgress = {
  readonly goal: Goal;
  readonly currentAmount: number;
  readonly progress: GoalProgress;
  readonly projection: GoalProjection;
  readonly installments: InstallmentProgress;
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
      const monthlyTotals = getMonthlyTotalsByType(db, userIdRef, 3);

      const goalsWithProgress: GoalWithProgress[] = goalRows.map((goal) => {
        const currentAmount = getGoalCurrentAmount(db, goal.id);
        const progress = deriveGoalProgress(goal, currentAmount);
        const savingsProjection = deriveGoalProjection(goal, currentAmount, monthlyTotals);

        // For debt goals with interest, use amortization-based projection
        const projection: GoalProjection =
          goal.type === "debt" && goal.interestRatePercent != null && savingsProjection.netMonthlySavings > 0
            ? (() => {
                const debtResult = deriveDebtProjection(goal, currentAmount, savingsProjection.netMonthlySavings);
                if (debtResult.status === "ok" || debtResult.status === "zero_rate") {
                  return {
                    projectedDate: debtResult.projectedDate,
                    monthsToGo: debtResult.monthsToGo,
                    confidence: savingsProjection.confidence,
                    netMonthlySavings: savingsProjection.netMonthlySavings,
                  };
                }
                // payment_too_low or complete — fall back to savings projection
                return savingsProjection;
              })()
            : savingsProjection;

        const contributionMonths = getContributionMonthCount(db, goal.id);
        const installments = deriveInstallmentProgress(
          goal.targetAmount,
          projection.netMonthlySavings,
          contributionMonths
        );
        return { goal, currentAmount, progress, projection, installments };
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
    const now = new Date().toISOString();
    const id = generateId("gl");
    try {
      insertGoal(dbRef, {
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
      });
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "goals",
        rowId: id,
        operation: "insert",
        createdAt: now,
      });
    } catch {
      return false;
    }
    await get().loadGoals();
    return true;
  },

  updateGoal: async (id, data) => {
    if (!dbRef) return;
    const now = new Date().toISOString();
    try {
      updateGoal(dbRef, id, data, now);
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "goals",
        rowId: id,
        operation: "update",
        createdAt: now,
      });
    } catch {
      return;
    }
    await get().loadGoals();
  },

  deleteGoal: async (id) => {
    if (!dbRef) return;
    const now = new Date().toISOString();
    try {
      softDeleteGoal(dbRef, id, now);
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "goals",
        rowId: id,
        operation: "delete",
        createdAt: now,
      });
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
    const now = new Date().toISOString();
    const id = generateId("gc");
    try {
      insertContribution(dbRef, {
        id,
        goalId: input.goalId,
        userId: userIdRef,
        amount: input.amount,
        note: input.note ?? null,
        date: input.date,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "goalContributions",
        rowId: id,
        operation: "insert",
        createdAt: now,
      });
    } catch {
      return false;
    }
    await get().loadGoals();
    // Refresh contributions if viewing this goal
    if (get().selectedGoalId === input.goalId) {
      get().loadGoalContributions(input.goalId);
    }
    return true;
  },

  deleteContribution: async (id) => {
    if (!dbRef) return;
    const now = new Date().toISOString();
    try {
      softDeleteContribution(dbRef, id, now);
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "goalContributions",
        rowId: id,
        operation: "delete",
        createdAt: now,
      });
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
      const monthlyTotals = getMonthlyTotalsByType(db, userIdRef, 3);
      const { goals } = get();
      const updated = goals.map((g) => {
        const currentAmount = getGoalCurrentAmount(db, g.goal.id);
        const progress = deriveGoalProgress(g.goal, currentAmount);
        const savingsProj = deriveGoalProjection(g.goal, currentAmount, monthlyTotals);

        const projection: GoalProjection =
          g.goal.type === "debt" && g.goal.interestRatePercent != null && savingsProj.netMonthlySavings > 0
            ? (() => {
                const dr = deriveDebtProjection(g.goal, currentAmount, savingsProj.netMonthlySavings);
                if (dr.status === "ok" || dr.status === "zero_rate") {
                  return { projectedDate: dr.projectedDate, monthsToGo: dr.monthsToGo, confidence: savingsProj.confidence, netMonthlySavings: savingsProj.netMonthlySavings };
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
        return { goal: g.goal, currentAmount, progress, projection, installments };
      });
      set({ goals: updated });
    } catch {
      // keep existing state
    }
  },
}));
