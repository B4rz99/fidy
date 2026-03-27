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
  readonly isLoading: boolean;
};

type DashboardActions = {
  initStore(db: AnyDb, userId: UserId): void;
  setPeriod(period: DashboardPeriod): void;
  loadDashboard(): Promise<void>;
};

export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => ({
  period: "month",
  periodSpent: 0 as CopAmount,
  periodCategorySpending: [],
  periodDailySpending: [],
  isLoading: false,

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
      if (!get().isLoading) {
        get()
          .loadDashboard()
          .catch(() => {});
      }
    });
  },

  setPeriod: (period) => {
    set({ period });
    get()
      .loadDashboard()
      .catch(() => {});
  },

  loadDashboard: async () => {
    if (!dbRef || !userIdRef) return;
    const db = dbRef;
    const userId = userIdRef;
    set({ isLoading: true });
    try {
      const { spending, lineChart } = computeDashboardRange(get().period, new Date());

      // Not parallel — synchronous SQLite must be called sequentially
      const incomeExpense = getIncomeExpenseForPeriod(db, userId, spending.start, spending.end);
      const categorySpending = getSpendingByCategoryForPeriod(
        db,
        userId,
        spending.start,
        spending.end
      );
      const dailySpending = getDailySpendingAggregate(db, userId, lineChart.start, lineChart.end);

      const periodSpent = incomeExpense.expenses;
      const periodCategorySpending = deriveCategoryBreakdown(categorySpending, periodSpent);

      set({
        periodSpent,
        periodCategorySpending,
        periodDailySpending: dailySpending,
        isLoading: false,
      });
    } catch (error) {
      console.error("[dashboard] loadDashboard failed:", error);
      set({ isLoading: false });
    }
  },
}));
