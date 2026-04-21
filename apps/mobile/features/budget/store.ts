import { addMonths, subMonths } from "date-fns";
import { create, type StateCreator } from "zustand";
import { insertNotificationRecord } from "@/features/notifications";
import { useSettingsStore } from "@/features/settings";
import { CATEGORY_MAP } from "@/features/transactions";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { getCategoryLabel, useLocaleStore } from "@/shared/i18n";
import { generateBudgetId, toIsoDateTime, toMonth, trackBudgetCreated } from "@/shared/lib";
import type { BudgetId, CategoryId, CopAmount, Month, UserId } from "@/shared/types/branded";
import type { BudgetAlert, BudgetProgress, BudgetSuggestion } from "./lib/derive";
import type { BudgetMonthSnapshot } from "./lib/monitoring";
import { createBudgetMonitoringModule } from "./lib/monitoring";
import { scheduleBudgetAlert } from "./lib/notifications";
import type { Budget } from "./schema";
import { createBudgetSchema } from "./schema";

let budgetSessionId = 0;
let loadBudgetsRequestId = 0;

const formatMonth = (date: Date): Month => toMonth(date);

/** Parse "YYYY-MM" to a local-time Date (1st of month). Avoids UTC date-only parsing pitfall. */
const parseMonth = (month: Month): Date => {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthIndex = (parts[1] ?? 1) - 1;
  return new Date(year, monthIndex, 1);
};

const createLiveBudgetMonitoring = (
  db: AnyDb,
  userId: UserId,
  shouldDeliverSideEffects: () => boolean
) =>
  createBudgetMonitoringModule({
    getBudgetAlertsEnabled: () => useSettingsStore.getState().notificationPreferences.budgetAlerts,
    getLocale: () => useLocaleStore.getState().locale,
    resolveCategoryLabel: (categoryId, locale) => {
      const category = CATEGORY_MAP[categoryId];
      return category ? getCategoryLabel(category, locale) : categoryId;
    },
    scheduleBudgetAlert: async (alert, categoryName, notificationsEnabled) => {
      if (!shouldDeliverSideEffects()) return { type: "skipped" } as const;
      return scheduleBudgetAlert(alert, categoryName, notificationsEnabled);
    },
    insertNotification: (input) => {
      if (!shouldDeliverSideEffects()) return;
      void insertNotificationRecord(db, userId, input);
    },
  });

const budgetAlertStateManager = createBudgetMonitoringModule({
  getBudgetAlertsEnabled: () => false,
  getLocale: () => "es",
  resolveCategoryLabel: (categoryId) => categoryId,
  scheduleBudgetAlert: async () => ({ type: "skipped" }),
  insertNotification: () => undefined,
});

type BudgetState = {
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

type BudgetActions = {
  beginSession: (userId: UserId) => void;
  setMonth: (month: Month) => void;
  setSnapshot: (snapshot: BudgetMonthSnapshot) => void;
  setAutoSuggestions: (autoSuggestions: readonly BudgetSuggestion[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  acknowledgeAlert: (budgetId: BudgetId, threshold: 80 | 100) => void;
  clearPendingPermissionRequest: () => void;
};

type BudgetStore = BudgetState & BudgetActions;
type BudgetSetState = Parameters<StateCreator<BudgetStore>>[0];
type BudgetRequest = {
  readonly requestId: number;
  readonly userId: UserId;
  readonly month: Month;
  readonly sessionId: number;
};
type UpdateBudgetInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly id: BudgetId;
  readonly amount: CopAmount;
};

function createBudgetState(currentMonth: Month, activeUserId: UserId | null): BudgetState {
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

function acknowledgeBudgetAlert(set: BudgetSetState): BudgetActions["acknowledgeAlert"] {
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

function createBudgetActions(set: BudgetSetState): BudgetActions {
  return {
    beginSession: beginBudgetSession(set),
    setMonth: (currentMonth) => set({ currentMonth }),
    setSnapshot: setBudgetSnapshot(set),
    setAutoSuggestions: (autoSuggestions) =>
      set({ autoSuggestions: [...autoSuggestions] as BudgetSuggestion[] }),
    setIsLoading: (isLoading) => set({ isLoading }),
    acknowledgeAlert: acknowledgeBudgetAlert(set),
    clearPendingPermissionRequest: () => {
      set({ pendingPermissionRequest: false });
    },
  };
}

const createBudgetStoreState: StateCreator<BudgetStore> = (set) => ({
  ...createBudgetState(formatMonth(new Date()), null),
  ...createBudgetActions(set),
});

export const useBudgetStore = create<BudgetStore>(createBudgetStoreState);

function isActiveBudgetSession(userId: UserId, sessionId: number): boolean {
  return budgetSessionId === sessionId && useBudgetStore.getState().activeUserId === userId;
}

async function refreshBudgetsForActiveSession(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly sessionId: number;
}): Promise<boolean> {
  if (!isActiveBudgetSession(input.userId, input.sessionId)) return false;
  await loadBudgetsForUser(input.db, input.userId);
  return isActiveBudgetSession(input.userId, input.sessionId);
}

export function initializeBudgetSession(userId: UserId): void {
  budgetSessionId += 1;
  loadBudgetsRequestId += 1;
  useBudgetStore.getState().beginSession(userId);
}

export async function loadBudgetsForUser(db: AnyDb, userId: UserId): Promise<void> {
  const request: BudgetRequest = {
    requestId: ++loadBudgetsRequestId,
    userId,
    month: useBudgetStore.getState().currentMonth,
    sessionId: budgetSessionId,
  };
  const isCurrentRequest = () =>
    loadBudgetsRequestId === request.requestId &&
    isActiveBudgetSession(request.userId, request.sessionId) &&
    useBudgetStore.getState().currentMonth === request.month;
  const previous = {
    pendingAlerts: useBudgetStore.getState().pendingAlerts,
    acknowledgedAlerts: useBudgetStore.getState().acknowledgedAlerts,
  };

  useBudgetStore.getState().setIsLoading(true);

  try {
    const snapshot = await createLiveBudgetMonitoring(db, userId, isCurrentRequest).refreshMonth({
      db,
      userId,
      month: request.month,
      previous,
    });

    if (!isCurrentRequest()) {
      if (loadBudgetsRequestId === request.requestId) {
        useBudgetStore.getState().setIsLoading(false);
      }
      return;
    }

    useBudgetStore.getState().setSnapshot(snapshot);
  } catch {
    if (loadBudgetsRequestId === request.requestId) {
      useBudgetStore.getState().setIsLoading(false);
    }
  }
}

export async function nextBudgetMonth(db: AnyDb, userId: UserId): Promise<void> {
  const next = formatMonth(addMonths(parseMonth(useBudgetStore.getState().currentMonth), 1));
  useBudgetStore.getState().setMonth(next);
  await loadBudgetsForUser(db, userId);
}

export async function prevBudgetMonth(db: AnyDb, userId: UserId): Promise<void> {
  const previous = formatMonth(subMonths(parseMonth(useBudgetStore.getState().currentMonth), 1));
  useBudgetStore.getState().setMonth(previous);
  await loadBudgetsForUser(db, userId);
}

export function loadBudgetAutoSuggestions(db: AnyDb, userId: UserId): void {
  const { currentMonth, budgets, activeUserId } = useBudgetStore.getState();
  if (activeUserId !== userId) return;

  try {
    const autoSuggestions = createLiveBudgetMonitoring(db, userId, () => true).loadAutoSuggestions({
      db,
      userId,
      month: currentMonth,
      existingCategoryIds: new Set(budgets.map((budget) => budget.categoryId)),
    });
    if (useBudgetStore.getState().activeUserId !== userId) return;
    useBudgetStore.getState().setAutoSuggestions(autoSuggestions);
  } catch {
    // Query failed — keep existing suggestions.
  }
}

export async function createBudget(
  db: AnyDb,
  userId: UserId,
  categoryId: CategoryId,
  amount: CopAmount
): Promise<boolean> {
  const currentMonth = useBudgetStore.getState().currentMonth;
  const validation = createBudgetSchema.safeParse({
    categoryId,
    amount,
    month: currentMonth,
  });
  if (!validation.success) return false;

  const sessionId = budgetSessionId;
  const now = toIsoDateTime(new Date());

  try {
    const result = await createWriteThroughMutationModule(db).commit({
      kind: "budget.save",
      row: {
        id: generateBudgetId(),
        userId,
        categoryId,
        amount,
        month: currentMonth,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    });
    if (!result.success) return false;
  } catch {
    return false;
  }

  trackBudgetCreated({ category: String(categoryId) });
  return refreshBudgetsForActiveSession({ db, userId, sessionId });
}

export async function updateBudget(input: UpdateBudgetInput): Promise<boolean> {
  const { db, userId, id, amount } = input;
  const sessionId = budgetSessionId;
  const now = toIsoDateTime(new Date());

  try {
    const result = await createWriteThroughMutationModule(db).commit({
      kind: "budget.update",
      budgetId: id,
      amount,
      now,
    });
    if (!result.success) return false;
  } catch {
    return false;
  }

  return refreshBudgetsForActiveSession({ db, userId, sessionId });
}

export async function deleteBudget(db: AnyDb, userId: UserId, id: BudgetId): Promise<boolean> {
  const sessionId = budgetSessionId;
  const now = toIsoDateTime(new Date());

  try {
    const result = await createWriteThroughMutationModule(db).commit({
      kind: "budget.delete",
      budgetId: id,
      now,
    });
    if (!result.success) return false;
  } catch {
    return false;
  }

  return refreshBudgetsForActiveSession({ db, userId, sessionId });
}

export async function copyBudgetsForward(
  db: AnyDb,
  userId: UserId,
  targetMonth: Month
): Promise<boolean> {
  const sessionId = budgetSessionId;
  const sourceMonth = useBudgetStore.getState().currentMonth;
  const now = toIsoDateTime(new Date());

  try {
    const result = await createWriteThroughMutationModule(db).commit({
      kind: "budget.copy",
      sourceMonth,
      targetMonth,
      userId,
      now,
    });
    if (!result.success) return false;
  } catch {
    return false;
  }

  if (!isActiveBudgetSession(userId, sessionId)) return false;
  useBudgetStore.getState().setMonth(targetMonth);
  return refreshBudgetsForActiveSession({ db, userId, sessionId });
}

export async function acceptBudgetSuggestions(
  db: AnyDb,
  userId: UserId,
  budgetsByCategory: ReadonlyMap<CategoryId, CopAmount>
): Promise<boolean> {
  const entries = Array.from(budgetsByCategory.entries());
  if (entries.length === 0) return true;

  const sessionId = budgetSessionId;
  const currentMonth = useBudgetStore.getState().currentMonth;
  const now = toIsoDateTime(new Date());

  try {
    const result = await createWriteThroughMutationModule(db).commitBatch(
      entries.map(([categoryId, amount]) => ({
        kind: "budget.save" as const,
        row: {
          id: generateBudgetId(),
          userId,
          categoryId,
          amount,
          month: currentMonth,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      }))
    );
    if (result.some((item) => !item.success)) return false;
  } catch {
    return false;
  }

  return refreshBudgetsForActiveSession({ db, userId, sessionId });
}
