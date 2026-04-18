import { create } from "zustand";
import { useTransactionStore } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type {
  AnalyticsPeriod,
  CategoryBreakdownItem,
  IncomeExpenseResult,
  PeriodDelta,
} from "./lib/derive";
import {
  computePeriodRange,
  deriveCategoryBreakdown,
  deriveIncomeExpense,
  derivePeriodDelta,
} from "./lib/derive";
import { getIncomeExpenseForPeriod, getSpendingByCategoryForPeriod } from "./lib/repository";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;
let unsubscribeTxStore: (() => void) | null = null;
// Track previous pages reference to skip form-field state changes
let prevPagesRef: unknown = null;

type AnalyticsState = {
  readonly period: AnalyticsPeriod;
  readonly incomeExpense: IncomeExpenseResult | null;
  readonly categoryBreakdown: readonly CategoryBreakdownItem[];
  readonly periodDelta: PeriodDelta | null;
  readonly isLoading: boolean;
};

type AnalyticsActions = {
  initStore(db: AnyDb, userId: UserId): void;
  setPeriod(period: AnalyticsPeriod): void;
  loadAnalytics(): Promise<void>;
};

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>((set, get) => ({
  period: "M",
  incomeExpense: null,
  categoryBreakdown: [],
  periodDelta: null,
  isLoading: false,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    // Subscribe to transaction store changes to auto-refresh analytics
    if (unsubscribeTxStore) unsubscribeTxStore();
    prevPagesRef = useTransactionStore.getState().pages;
    unsubscribeTxStore = useTransactionStore.subscribe(() => {
      // Only refresh when transaction data changes, not form field edits
      const currentPages = useTransactionStore.getState().pages;
      if (currentPages === prevPagesRef) return;
      prevPagesRef = currentPages;
      if (get().incomeExpense !== null) {
        get().loadAnalytics().catch(captureError);
      }
    });
  },

  setPeriod: (period) => {
    set({ period });
    get().loadAnalytics().catch(captureError);
  },

  loadAnalytics: async () => {
    if (!dbRef || !userIdRef) return;
    const db = dbRef;
    const userId = userIdRef;
    set({ isLoading: true });
    try {
      const { current, previous } = computePeriodRange(get().period, new Date());

      // Not parallel — synchronous SQLite must be called sequentially
      const currentIncomeExpense = getIncomeExpenseForPeriod(
        db,
        userId,
        current.start,
        current.end
      );
      const previousIncomeExpense = getIncomeExpenseForPeriod(
        db,
        userId,
        previous.start,
        previous.end
      );
      const currentSpending = getSpendingByCategoryForPeriod(
        db,
        userId,
        current.start,
        current.end
      );
      const previousSpending = getSpendingByCategoryForPeriod(
        db,
        userId,
        previous.start,
        previous.end
      );

      const incomeExpense = deriveIncomeExpense(
        currentIncomeExpense.income,
        currentIncomeExpense.expenses
      );
      const categoryBreakdown = deriveCategoryBreakdown(
        currentSpending,
        currentIncomeExpense.expenses
      );
      const periodDelta = derivePeriodDelta(
        {
          totalExpenses: currentIncomeExpense.expenses,
          categorySpending: currentSpending,
        },
        {
          totalExpenses: previousIncomeExpense.expenses,
          categorySpending: previousSpending,
        }
      );

      set({ incomeExpense, categoryBreakdown, periodDelta, isLoading: false });
    } catch (error) {
      console.error("[analytics] loadAnalytics failed:", error);
      set({ isLoading: false });
    }
  },
}));
