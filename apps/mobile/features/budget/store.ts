import { addMonths, format, subMonths } from "date-fns";
import { create } from "zustand";
import { insertNotificationRecord } from "@/features/notifications";
import { useSettingsStore } from "@/features/settings";
import { CATEGORY_MAP, useTransactionStore } from "@/features/transactions";
import { createWriteThroughMutationModule, type WriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { getCategoryLabel, useLocaleStore } from "@/shared/i18n";
import { generateBudgetId, toIsoDateTime, trackBudgetCreated } from "@/shared/lib";
import type { BudgetId, CategoryId, CopAmount, Month, UserId } from "@/shared/types/branded";
import type { BudgetAlert, BudgetProgress, BudgetSuggestion } from "./lib/derive";
import { createBudgetMonitoringModule } from "./lib/monitoring";
import { scheduleBudgetAlert } from "./lib/notifications";
import type { Budget } from "./schema";
import { createBudgetSchema } from "./schema";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;
let unsubscribeTxStore: (() => void) | null = null;
let loadBudgetsRequestId = 0;
let mutations: WriteThroughMutationModule | null = null;

const formatMonth = (date: Date): Month => format(date, "yyyy-MM") as Month;

/** Parse "YYYY-MM" to a local-time Date (1st of month). Avoids UTC date-only parsing pitfall. */
const parseMonth = (month: Month): Date => {
  const parts = month.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  return new Date(y, m - 1, 1);
};

const budgetMonitoring = createBudgetMonitoringModule({
  getBudgetAlertsEnabled: () => useSettingsStore.getState().notificationPreferences.budgetAlerts,
  getLocale: () => useLocaleStore.getState().locale,
  resolveCategoryLabel: (categoryId, locale) => {
    const category = CATEGORY_MAP[categoryId];
    return category ? getCategoryLabel(category, locale) : categoryId;
  },
  scheduleBudgetAlert,
  insertNotification: (input) => {
    if (!dbRef || !userIdRef) return;
    void insertNotificationRecord(dbRef, userIdRef, input);
  },
});

type BudgetState = {
  currentMonth: Month;
  budgets: Budget[];
  budgetProgress: BudgetProgress[];
  summary: { totalBudget: number; totalSpent: number; percentUsed: number };
  autoSuggestions: BudgetSuggestion[];
  acknowledgedAlerts: Set<string>; // "budgetId:threshold" keys
  pendingAlerts: readonly BudgetAlert[];
  pendingPermissionRequest: boolean;
  isLoading: boolean;
};

type BudgetActions = {
  initStore: (db: AnyDb, userId: UserId) => void;
  setMonth: (month: Month) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  loadBudgets: () => Promise<void>;
  refreshProgress: () => void;
  createBudget: (categoryId: CategoryId, amount: CopAmount) => Promise<boolean>;
  updateBudget: (id: BudgetId, amount: CopAmount) => Promise<void>;
  deleteBudget: (id: BudgetId) => Promise<void>;
  copyBudgetsForward: (targetMonth: Month) => Promise<void>;
  loadAutoSuggestions: () => void;
  acceptSuggestions: (budgets: ReadonlyMap<CategoryId, CopAmount>) => Promise<void>;
  acknowledgeAlert: (budgetId: BudgetId, threshold: 80 | 100) => void;
  clearPendingPermissionRequest: () => void;
};

export const useBudgetStore = create<BudgetState & BudgetActions>((set, get) => ({
  currentMonth: formatMonth(new Date()),
  budgets: [],
  budgetProgress: [],
  summary: { totalBudget: 0, totalSpent: 0, percentUsed: 0 },
  autoSuggestions: [],
  acknowledgedAlerts: new Set(),
  pendingAlerts: [],
  pendingPermissionRequest: false,
  isLoading: false,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    mutations = createWriteThroughMutationModule(db);
    // Subscribe to transaction store changes to auto-refresh progress
    if (unsubscribeTxStore) unsubscribeTxStore();
    unsubscribeTxStore = useTransactionStore.subscribe(() => {
      // Re-run the full month refresh so transaction changes and alert policy stay in one path.
      void get().loadBudgets();
    });
  },

  setMonth: (month) => {
    set({ currentMonth: month });
    void get().loadBudgets();
  },

  nextMonth: () => {
    const current = parseMonth(get().currentMonth);
    const next = addMonths(current, 1);
    get().setMonth(formatMonth(next));
  },

  prevMonth: () => {
    const current = parseMonth(get().currentMonth);
    const prev = subMonths(current, 1);
    get().setMonth(formatMonth(prev));
  },

  loadBudgets: async () => {
    if (!dbRef || !userIdRef) return;
    const requestId = ++loadBudgetsRequestId;
    const requestedDb = dbRef;
    const requestedUserId = userIdRef;
    const requestedMonth = get().currentMonth;
    const previous = {
      pendingAlerts: get().pendingAlerts,
      acknowledgedAlerts: get().acknowledgedAlerts,
    };
    set({ isLoading: true });
    try {
      const snapshot = await budgetMonitoring.refreshMonth({
        db: requestedDb,
        userId: requestedUserId,
        month: requestedMonth,
        previous,
      });
      const superseded = loadBudgetsRequestId !== requestId;
      const contextChanged =
        dbRef !== requestedDb ||
        userIdRef !== requestedUserId ||
        get().currentMonth !== requestedMonth;
      if (superseded || contextChanged) {
        if (!superseded) {
          set({ isLoading: false });
        }
        return;
      }
      set((state) => ({
        budgets: snapshot.budgets as Budget[],
        budgetProgress: snapshot.budgetProgress as BudgetProgress[],
        summary: snapshot.summary,
        autoSuggestions: snapshot.autoSuggestions as BudgetSuggestion[],
        pendingAlerts: snapshot.pendingAlerts,
        pendingPermissionRequest:
          state.pendingPermissionRequest || snapshot.pendingPermissionRequest,
        isLoading: false,
      }));
    } catch {
      if (loadBudgetsRequestId === requestId) {
        set({ isLoading: false });
      }
    }
  },

  refreshProgress: () => {
    void get().loadBudgets();
  },

  loadAutoSuggestions: () => {
    if (!dbRef || !userIdRef) return;
    const { currentMonth, budgets } = get();
    try {
      const autoSuggestions = budgetMonitoring.loadAutoSuggestions({
        db: dbRef,
        userId: userIdRef,
        month: currentMonth,
        existingCategoryIds: new Set(budgets.map((budget) => budget.categoryId)),
      });
      set({ autoSuggestions: autoSuggestions as BudgetSuggestion[] });
    } catch {
      // Query failed — keep existing suggestions
    }
  },

  createBudget: async (categoryId, amount) => {
    if (!dbRef || !userIdRef) return false;
    const validation = createBudgetSchema.safeParse({
      categoryId,
      amount,
      month: get().currentMonth,
    });
    if (!validation.success) return false;
    const mutationModule = mutations;
    if (!mutationModule) return false;
    const now = toIsoDateTime(new Date());
    const id = generateBudgetId();
    try {
      const result = await mutationModule.commit({
        kind: "budget.save",
        row: {
          id,
          userId: userIdRef,
          categoryId,
          amount,
          month: get().currentMonth,
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
    await get().loadBudgets();
    return true;
  },

  updateBudget: async (id, amount) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    const now = toIsoDateTime(new Date());
    try {
      const result = await mutationModule.commit({
        kind: "budget.update",
        budgetId: id,
        amount,
        now,
      });
      if (!result.success) return;
    } catch {
      return;
    }
    await get().loadBudgets();
  },

  deleteBudget: async (id) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    const now = toIsoDateTime(new Date());
    try {
      const result = await mutationModule.commit({
        kind: "budget.delete",
        budgetId: id,
        now,
      });
      if (!result.success) return;
    } catch {
      return;
    }
    await get().loadBudgets();
  },

  copyBudgetsForward: async (targetMonth) => {
    if (!dbRef || !userIdRef) return;
    const userId = userIdRef;
    const now = toIsoDateTime(new Date());
    const mutationModule = mutations;
    if (!mutationModule) return;
    try {
      const result = await mutationModule.commit({
        kind: "budget.copy",
        sourceMonth: get().currentMonth,
        targetMonth,
        userId,
        now,
      });
      if (!result.success) return;
    } catch {
      return;
    }
    // Navigate to target month and reload
    set({ currentMonth: targetMonth });
    await get().loadBudgets();
  },

  acceptSuggestions: async (budgetsByCategory) => {
    if (!dbRef || !userIdRef) return;
    const userId = userIdRef;
    const { currentMonth } = get();
    const now = toIsoDateTime(new Date());
    const entries = Array.from(budgetsByCategory.entries());
    if (entries.length === 0) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    try {
      const result = await mutationModule.commitBatch(
        entries.map(([categoryId, amount]) => ({
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
        }))
      );
      if (result.some((item) => !item.success)) return;
    } catch {
      return;
    }
    await get().loadBudgets();
  },

  acknowledgeAlert: (budgetId, threshold) => {
    set((state) => {
      const nextState = budgetMonitoring.acknowledgeAlert({
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
  },

  clearPendingPermissionRequest: () => {
    set({ pendingPermissionRequest: false });
  },
}));
