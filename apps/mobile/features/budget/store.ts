import { addMonths, format, subMonths } from "date-fns";
import { create } from "zustand";
import { CATEGORY_MAP, useTransactionStore } from "@/features/transactions";
import { getSpendingByCategoryAggregate } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import { getCategoryLabel, useLocaleStore } from "@/shared/i18n";
import { generateId } from "@/shared/lib";
import type { BudgetAlert, BudgetProgress, BudgetSuggestion } from "./lib/derive";
import {
  deriveAutoSuggestBudgets,
  deriveBudgetAlerts,
  deriveBudgetProgress,
  deriveBudgetSummary,
} from "./lib/derive";
import { scheduleBudgetAlert } from "./lib/notifications";
import {
  copyBudgetsToMonth,
  getBudgetsForMonth,
  insertBudget,
  softDeleteBudget,
  updateBudgetAmount,
} from "./lib/repository";
import type { Budget } from "./schema";
import { createBudgetSchema } from "./schema";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;
let unsubscribeTxStore: (() => void) | null = null;

const formatMonth = (date: Date): string => format(date, "yyyy-MM");

/** Parse "YYYY-MM" to a local-time Date (1st of month). Avoids UTC date-only parsing pitfall. */
const parseMonth = (month: string): Date => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1);
};

type BudgetState = {
  currentMonth: string; // YYYY-MM format
  budgets: Budget[];
  budgetProgress: BudgetProgress[];
  summary: { totalBudgetCents: number; totalSpentCents: number; percentUsed: number };
  autoSuggestions: BudgetSuggestion[];
  acknowledgedAlerts: Set<string>; // "budgetId:threshold" keys
  pendingAlerts: readonly BudgetAlert[];
  isLoading: boolean;
};

type BudgetActions = {
  initStore: (db: AnyDb, userId: string) => void;
  setMonth: (month: string) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  loadBudgets: () => Promise<void>;
  refreshProgress: () => void;
  createBudget: (categoryId: string, amountCents: number) => Promise<boolean>;
  updateBudget: (id: string, amountCents: number) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  copyBudgetsForward: (targetMonth: string) => Promise<void>;
  loadAutoSuggestions: () => void;
  acceptSuggestions: (budgets: ReadonlyMap<string, number>) => Promise<void>;
  acknowledgeAlert: (budgetId: string, threshold: 80 | 100) => void;
};

export const useBudgetStore = create<BudgetState & BudgetActions>((set, get) => ({
  currentMonth: formatMonth(new Date()),
  budgets: [],
  budgetProgress: [],
  summary: { totalBudgetCents: 0, totalSpentCents: 0, percentUsed: 0 },
  autoSuggestions: [],
  acknowledgedAlerts: new Set(),
  pendingAlerts: [],
  isLoading: false,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    // Subscribe to transaction store changes to auto-refresh progress
    if (unsubscribeTxStore) unsubscribeTxStore();
    unsubscribeTxStore = useTransactionStore.subscribe(() => {
      // When transactions change, refresh budget progress
      if (get().budgets.length > 0) {
        get().refreshProgress();
      }
    });
  },

  setMonth: (month) => {
    set({ currentMonth: month });
    get()
      .loadBudgets()
      .catch(() => {});
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
    set({ isLoading: true });
    try {
      const rows = getBudgetsForMonth(dbRef, userIdRef, get().currentMonth);
      set({ budgets: rows as Budget[], isLoading: false });
      get().refreshProgress();
      get().loadAutoSuggestions();
    } catch {
      set({ isLoading: false });
    }
  },

  refreshProgress: () => {
    if (!dbRef || !userIdRef) return;
    const { budgets, acknowledgedAlerts, currentMonth, pendingAlerts: previousAlerts } = get();
    try {
      const spending = getSpendingByCategoryAggregate(dbRef, userIdRef, currentMonth);
      const spendingMap = new Map(spending.map((s) => [s.categoryId, s.totalCents]));
      const progresses = budgets.map((b) =>
        deriveBudgetProgress(b, spendingMap.get(b.categoryId) ?? 0)
      );
      const summary = deriveBudgetSummary(progresses);
      const newPendingAlerts = deriveBudgetAlerts(progresses, acknowledgedAlerts);
      set({ budgetProgress: progresses, summary, pendingAlerts: newPendingAlerts });

      // Schedule push notifications for truly new alerts (best-effort, don't block)
      const previousKeys = new Set(previousAlerts.map((a) => `${a.budgetId}:${a.threshold}`));
      const freshAlerts = newPendingAlerts.filter(
        (a) => !previousKeys.has(`${a.budgetId}:${a.threshold}`)
      );
      const locale = useLocaleStore.getState().locale;
      freshAlerts.forEach((alert) => {
        const category = CATEGORY_MAP[alert.categoryId];
        const name = category ? getCategoryLabel(category, locale) : alert.categoryId;
        scheduleBudgetAlert(alert, name).catch(() => {});
      });
    } catch {
      // Query failed — keep existing state
    }
  },

  createBudget: async (categoryId, amountCents) => {
    if (!dbRef || !userIdRef) return false;
    const validation = createBudgetSchema.safeParse({
      categoryId,
      amountCents,
      month: get().currentMonth,
    });
    if (!validation.success) return false;
    const now = new Date().toISOString();
    const id = generateId("bgt");
    try {
      insertBudget(dbRef, {
        id,
        userId: userIdRef,
        categoryId,
        amountCents,
        month: get().currentMonth,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "budgets",
        rowId: id,
        operation: "insert",
        createdAt: now,
      });
    } catch {
      return false;
    }
    await get().loadBudgets();
    return true;
  },

  updateBudget: async (id, amountCents) => {
    if (!dbRef) return;
    const now = new Date().toISOString();
    try {
      updateBudgetAmount(dbRef, id, amountCents, now);
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "budgets",
        rowId: id,
        operation: "update",
        createdAt: now,
      });
    } catch {
      return;
    }
    await get().loadBudgets();
  },

  deleteBudget: async (id) => {
    if (!dbRef) return;
    const now = new Date().toISOString();
    try {
      softDeleteBudget(dbRef, id, now);
      enqueueSync(dbRef, {
        id: generateId("sq"),
        tableName: "budgets",
        rowId: id,
        operation: "delete",
        createdAt: now,
      });
    } catch {
      return;
    }
    await get().loadBudgets();
  },

  copyBudgetsForward: async (targetMonth) => {
    if (!dbRef || !userIdRef) return;
    const userId = userIdRef;
    const now = new Date().toISOString();
    try {
      dbRef.transaction((tx) => {
        const db = tx as unknown as AnyDb;
        const newIds = copyBudgetsToMonth(db, userId, get().currentMonth, targetMonth, now, () =>
          generateId("bgt")
        );
        // Enqueue sync for each copied budget
        newIds.forEach((newId) => {
          enqueueSync(db, {
            id: generateId("sq"),
            tableName: "budgets",
            rowId: newId,
            operation: "insert",
            createdAt: now,
          });
        });
      });
    } catch {
      return;
    }
    // Navigate to target month and reload
    set({ currentMonth: targetMonth });
    await get().loadBudgets();
  },

  loadAutoSuggestions: () => {
    if (!dbRef || !userIdRef) return;
    const { currentMonth, budgets } = get();
    try {
      const currentDate = parseMonth(currentMonth);
      const prevMonth = formatMonth(subMonths(currentDate, 1));
      const prevSpending = getSpendingByCategoryAggregate(dbRef, userIdRef, prevMonth);
      const existingCategoryIds = new Set(budgets.map((b) => b.categoryId));
      const suggestions = deriveAutoSuggestBudgets(prevSpending, existingCategoryIds);
      set({ autoSuggestions: suggestions as BudgetSuggestion[] });
    } catch {
      // Query failed — keep existing suggestions
    }
  },

  acceptSuggestions: async (budgetsByCategory) => {
    if (!dbRef || !userIdRef) return;
    const userId = userIdRef;
    const { currentMonth } = get();
    const now = new Date().toISOString();
    const entries = Array.from(budgetsByCategory.entries());
    if (entries.length === 0) return;
    try {
      dbRef.transaction((tx) => {
        const db = tx as unknown as AnyDb;
        entries.forEach(([categoryId, amountCents]) => {
          const id = generateId("bgt");
          insertBudget(db, {
            id,
            userId,
            categoryId,
            amountCents,
            month: currentMonth,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          enqueueSync(db, {
            id: generateId("sq"),
            tableName: "budgets",
            rowId: id,
            operation: "insert",
            createdAt: now,
          });
        });
      });
    } catch {
      return;
    }
    await get().loadBudgets();
  },

  acknowledgeAlert: (budgetId, threshold) => {
    set((s) => ({
      acknowledgedAlerts: new Set([...s.acknowledgedAlerts, `${budgetId}:${threshold}`]),
      pendingAlerts: s.pendingAlerts.filter(
        (a) => !(a.budgetId === budgetId && a.threshold === threshold)
      ),
    }));
  },
}));
