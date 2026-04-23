import type { StateCreator } from "zustand";
import type { BudgetId, Month, UserId } from "@/shared/types/branded";
import type { BudgetAlert, BudgetProgress, BudgetSuggestion } from "../lib/derive";
import type { BudgetAlertState, BudgetMonthSnapshot } from "../lib/monitoring";
import type { Budget } from "../schema";

export type BudgetState = {
  readonly activeUserId: UserId | null;
  readonly currentMonth: Month;
  readonly budgets: readonly Budget[];
  readonly budgetProgress: readonly BudgetProgress[];
  readonly summary: {
    readonly totalBudget: number;
    readonly totalSpent: number;
    readonly percentUsed: number;
  };
  readonly autoSuggestions: readonly BudgetSuggestion[];
  readonly acknowledgedAlerts: ReadonlySet<string>;
  readonly pendingAlerts: readonly BudgetAlert[];
  readonly pendingPermissionRequest: boolean;
  readonly hasLoadedOnce: boolean;
  readonly isLoading: boolean;
};

export type BudgetActions = {
  beginSession: (userId: UserId) => void;
  setMonth: (month: Month) => void;
  setSnapshot: (snapshot: BudgetMonthSnapshot) => void;
  setAutoSuggestions: (autoSuggestions: readonly BudgetSuggestion[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  acknowledgeAlert: (budgetId: BudgetId, threshold: 80 | 100) => void;
  clearPendingPermissionRequest: () => void;
};

export type BudgetStore = BudgetState & BudgetActions;

type BudgetSetState = Parameters<StateCreator<BudgetStore>>[0];

type BudgetAlertStateManager = {
  readonly acknowledgeAlert: (input: {
    readonly budgetId: BudgetId;
    readonly threshold: 80 | 100;
    readonly alertState: BudgetAlertState;
  }) => BudgetAlertState;
};

export function createBudgetState(currentMonth: Month, activeUserId: UserId | null): BudgetState {
  return {
    activeUserId,
    currentMonth,
    budgets: [],
    budgetProgress: [],
    summary: { totalBudget: 0, totalSpent: 0, percentUsed: 0 },
    autoSuggestions: [],
    acknowledgedAlerts: new Set(),
    pendingAlerts: [],
    pendingPermissionRequest: false,
    hasLoadedOnce: false,
    isLoading: false,
  };
}

function beginBudgetSession(set: BudgetSetState): BudgetActions["beginSession"] {
  return (userId) => set((state) => createBudgetState(state.currentMonth, userId));
}

function setBudgetSnapshot(set: BudgetSetState): BudgetActions["setSnapshot"] {
  return (snapshot) =>
    set((state) => ({
      budgets: snapshot.budgets as Budget[],
      budgetProgress: snapshot.budgetProgress as BudgetProgress[],
      summary: snapshot.summary,
      autoSuggestions: snapshot.autoSuggestions as BudgetSuggestion[],
      pendingAlerts: snapshot.pendingAlerts,
      pendingPermissionRequest: state.pendingPermissionRequest || snapshot.pendingPermissionRequest,
      hasLoadedOnce: true,
      isLoading: false,
    }));
}

function acknowledgeBudgetAlert(
  set: BudgetSetState,
  budgetAlertStateManager: BudgetAlertStateManager
): BudgetActions["acknowledgeAlert"] {
  return (budgetId, threshold) =>
    set((state) => {
      const nextState = budgetAlertStateManager.acknowledgeAlert({
        budgetId,
        threshold,
        alertState: {
          pendingAlerts: state.pendingAlerts,
          acknowledgedAlerts: state.acknowledgedAlerts,
        },
      });

      return {
        acknowledgedAlerts: new Set(nextState.acknowledgedAlerts),
        pendingAlerts: nextState.pendingAlerts,
      };
    });
}

export function createBudgetActions(
  set: BudgetSetState,
  budgetAlertStateManager: BudgetAlertStateManager
): BudgetActions {
  return {
    beginSession: beginBudgetSession(set),
    setMonth: (currentMonth) => set({ currentMonth }),
    setSnapshot: setBudgetSnapshot(set),
    setAutoSuggestions: (autoSuggestions) =>
      set({ autoSuggestions: [...autoSuggestions] as BudgetSuggestion[] }),
    setIsLoading: (isLoading) => set({ isLoading }),
    acknowledgeAlert: acknowledgeBudgetAlert(set, budgetAlertStateManager),
    clearPendingPermissionRequest: () => {
      set({ pendingPermissionRequest: false });
    },
  };
}

export function createBudgetStoreState(
  initialMonth: Month,
  budgetAlertStateManager: BudgetAlertStateManager
): StateCreator<BudgetStore> {
  return (set) => ({
    ...createBudgetState(initialMonth, null),
    ...createBudgetActions(set, budgetAlertStateManager),
  });
}
