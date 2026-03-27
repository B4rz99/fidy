import { create } from "zustand";
import type { CategoryBreakdownItem } from "@/features/analytics/lib/derive";
import { deriveCategoryBreakdown } from "@/features/analytics/lib/derive";
import {
  getIncomeExpenseForPeriod,
  getSpendingByCategoryForPeriod,
} from "@/features/analytics/lib/repository";
import { useTransactionStore } from "@/features/transactions";
import { getDailySpendingAggregate } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import type { CopAmount, IsoDate, UserId } from "@/shared/types/branded";
import type { DashboardPeriod } from "./lib/derive";
import { computeDashboardRange } from "./lib/derive";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;
let unsubscribeTxStore: (() => void) | null = null;
// Track previous pages reference to skip form-field state changes
let prevPagesRef: unknown = null;

type DashboardState = {
  readonly period: DashboardPeriod;
  readonly periodSpent: CopAmount;
  readonly periodCategorySpending: ReadonlyArray<CategoryBreakdownItem>;
  readonly periodDailySpending: ReadonlyArray<{ date: IsoDate; total: CopAmount }>;
};

type DashboardActions = {
  initStore(db: AnyDb, userId: UserId): void;
  setPeriod(period: DashboardPeriod): void;
  loadDashboard(): void;
};

export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => ({
  period: "month",
  periodSpent: 0 as CopAmount,
  periodCategorySpending: [],
  periodDailySpending: [],

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    // Subscribe to transaction store changes to auto-refresh dashboard
    if (unsubscribeTxStore) unsubscribeTxStore();
    prevPagesRef = useTransactionStore.getState().pages;
    unsubscribeTxStore = useTransactionStore.subscribe(() => {
      // Only refresh when transaction data changes, not form field edits
      const currentPages = useTransactionStore.getState().pages;
      if (currentPages === prevPagesRef) return;
      prevPagesRef = currentPages;
      try {
        get().loadDashboard();
      } catch (error) {
        console.error("[dashboard] auto-refresh failed:", error);
      }
    });
  },

  setPeriod: (period) => {
    if (!dbRef || !userIdRef) {
      set({ period });
      return;
    }
    // Compute everything synchronously and set in a single call to avoid
    // double re-renders (period change + data change as separate updates).
    const { spending, lineChart } = computeDashboardRange(period, new Date());
    const incomeExpense = getIncomeExpenseForPeriod(dbRef, userIdRef, spending.start, spending.end);
    const categorySpending = getSpendingByCategoryForPeriod(
      dbRef,
      userIdRef,
      spending.start,
      spending.end
    );
    const dailySpending = getDailySpendingAggregate(
      dbRef,
      userIdRef,
      lineChart.start,
      lineChart.end
    );
    const periodSpent = incomeExpense.expenses;
    set({
      period,
      periodSpent,
      periodCategorySpending: deriveCategoryBreakdown(categorySpending, periodSpent),
      periodDailySpending: dailySpending,
    });
  },

  loadDashboard: () => {
    if (!dbRef || !userIdRef) return;
    const { spending, lineChart } = computeDashboardRange(get().period, new Date());
    const incomeExpense = getIncomeExpenseForPeriod(dbRef, userIdRef, spending.start, spending.end);
    const categorySpending = getSpendingByCategoryForPeriod(
      dbRef,
      userIdRef,
      spending.start,
      spending.end
    );
    const dailySpending = getDailySpendingAggregate(
      dbRef,
      userIdRef,
      lineChart.start,
      lineChart.end
    );
    const periodSpent = incomeExpense.expenses;
    set({
      periodSpent,
      periodCategorySpending: deriveCategoryBreakdown(categorySpending, periodSpent),
      periodDailySpending: dailySpending,
    });
  },
}));
