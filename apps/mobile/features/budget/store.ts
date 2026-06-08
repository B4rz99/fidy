import { create } from "zustand";
import { insertNotificationRecord } from "@/features/notifications/public";
import { useSettingsStore } from "@/features/settings/public";
import { createWriteThroughMutationModule } from "@/mutations";
import { CATEGORY_MAP } from "@/shared/categories";
import type { AnyDb } from "@/shared/db/client";
import { getCategoryLabel, useLocaleStore } from "@/shared/i18n";
import { generateBudgetId, toIsoDateTime, trackBudgetCreated } from "@/shared/lib";
import type { BudgetId, CategoryId, CopAmount, Month, UserId } from "@/shared/types/branded";
import { createBudgetMonitoringModule } from "./lib/monitoring";
import { scheduleBudgetAlert } from "./lib/notifications";
import { createBudgetSchema } from "./schema";
import {
  formatBudgetMonth,
  nextBudgetMonth as getNextBudgetMonth,
  previousBudgetMonth,
} from "./store/month";
import { createBudgetStoreState } from "./store/state";

let budgetSessionId = 0;
let loadBudgetsRequestId = 0;

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
type UpdateBudgetInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly id: BudgetId;
  readonly amount: CopAmount;
};

export const useBudgetStore = create(
  createBudgetStoreState(formatBudgetMonth(new Date()), budgetAlertStateManager)
);

function isActiveBudgetSession(userId: UserId, sessionId: number): boolean {
  return budgetSessionId === sessionId && useBudgetStore.getState().activeUserId === userId;
}

async function refreshBudgetsForActiveSession(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly sessionId: number;
}): Promise<boolean> {
  if (!isActiveBudgetSession(input.userId, input.sessionId)) return false;
  const didCommit = await loadBudgetsForUser(input.db, input.userId);
  return didCommit && isActiveBudgetSession(input.userId, input.sessionId);
}

export function initializeBudgetSession(userId: UserId): void {
  budgetSessionId += 1;
  loadBudgetsRequestId += 1;
  useBudgetStore.getState().beginSession(userId);
}

export async function loadBudgetsForUser(db: AnyDb, userId: UserId): Promise<boolean> {
  const request = {
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
      return false;
    }

    useBudgetStore.getState().setSnapshot(snapshot);
    return true;
  } catch {
    if (loadBudgetsRequestId === request.requestId) {
      useBudgetStore.getState().setIsLoading(false);
    }
    return false;
  }
}

export async function nextBudgetMonth(db: AnyDb, userId: UserId): Promise<void> {
  const next = getNextBudgetMonth(useBudgetStore.getState().currentMonth);
  useBudgetStore.getState().setMonth(next);
  await loadBudgetsForUser(db, userId);
}

export async function prevBudgetMonth(db: AnyDb, userId: UserId): Promise<void> {
  const previous = previousBudgetMonth(useBudgetStore.getState().currentMonth);
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
