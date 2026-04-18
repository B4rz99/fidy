import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type {
  AnalyticsPeriod,
  CategoryBreakdownItem,
  IncomeExpenseResult,
  PeriodDelta,
} from "../lib/derive";
import {
  computePeriodRange,
  deriveCategoryBreakdown,
  deriveIncomeExpense,
  derivePeriodDelta,
} from "../lib/derive";
import { getIncomeExpenseForPeriod, getSpendingByCategoryForPeriod } from "../lib/repository";

export type AnalyticsSnapshot = {
  readonly incomeExpense: IncomeExpenseResult;
  readonly categoryBreakdown: readonly CategoryBreakdownItem[];
  readonly periodDelta: PeriodDelta;
};

type LoadAnalyticsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly period: AnalyticsPeriod;
};

type CreateAnalyticsServiceDeps = {
  readonly getNow?: () => Date;
  readonly getIncomeExpenseForPeriod?: typeof getIncomeExpenseForPeriod;
  readonly getSpendingByCategoryForPeriod?: typeof getSpendingByCategoryForPeriod;
};

export function createAnalyticsService({
  getNow = () => new Date(),
  getIncomeExpenseForPeriod: loadIncomeExpense = getIncomeExpenseForPeriod,
  getSpendingByCategoryForPeriod: loadSpendingByCategory = getSpendingByCategoryForPeriod,
}: CreateAnalyticsServiceDeps = {}) {
  return {
    loadSnapshot: async ({
      db,
      userId,
      period,
    }: LoadAnalyticsInput): Promise<AnalyticsSnapshot> => {
      const { current, previous } = computePeriodRange(period, getNow());

      const currentIncomeExpense = loadIncomeExpense(db, userId, current.start, current.end);
      const previousIncomeExpense = loadIncomeExpense(db, userId, previous.start, previous.end);
      const currentSpending = loadSpendingByCategory(db, userId, current.start, current.end);
      const previousSpending = loadSpendingByCategory(db, userId, previous.start, previous.end);

      return {
        incomeExpense: deriveIncomeExpense(
          currentIncomeExpense.income,
          currentIncomeExpense.expenses
        ),
        categoryBreakdown: deriveCategoryBreakdown(currentSpending, currentIncomeExpense.expenses),
        periodDelta: derivePeriodDelta(
          {
            totalExpenses: currentIncomeExpense.expenses,
            categorySpending: currentSpending,
          },
          {
            totalExpenses: previousIncomeExpense.expenses,
            categorySpending: previousSpending,
          }
        ),
      };
    },
  };
}
