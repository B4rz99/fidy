import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type {
  AnalyticsPeriod,
  CategoryBreakdownItem,
  CategoryExpenseItem,
  IncomeExpenseResult,
  PeriodDelta,
} from "../lib/derive";
import {
  computePeriodRange,
  deriveCategoryBreakdown,
  deriveIncomeExpense,
  derivePeriodDelta,
} from "../lib/derive";
import {
  type AnalyticsPeriodQuery,
  getExpenseTransactionsForPeriod,
  getIncomeExpenseForPeriod,
  getSpendingByCategoryForPeriod,
} from "../lib/repository";

export type AnalyticsSnapshot = {
  readonly incomeExpense: IncomeExpenseResult;
  readonly categoryBreakdown: readonly CategoryBreakdownItem[];
  readonly categoryExpenses: readonly CategoryExpenseItem[];
  readonly periodDelta: PeriodDelta;
};

type LoadAnalyticsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly period: AnalyticsPeriod;
};

type CreateAnalyticsServiceDeps = {
  readonly getNow?: () => Date;
  readonly getExpenseTransactionsForPeriod?: typeof getExpenseTransactionsForPeriod;
  readonly getIncomeExpenseForPeriod?: typeof getIncomeExpenseForPeriod;
  readonly getSpendingByCategoryForPeriod?: typeof getSpendingByCategoryForPeriod;
};

type PeriodDeltaInput = Parameters<typeof derivePeriodDelta>[0];

function buildPeriodDeltaInput(
  totalExpenses: PeriodDeltaInput["totalExpenses"],
  categorySpending: PeriodDeltaInput["categorySpending"]
): PeriodDeltaInput {
  return { totalExpenses, categorySpending };
}

function buildPeriodQuery(
  input: Pick<LoadAnalyticsInput, "db" | "userId">,
  range: {
    readonly start: AnalyticsPeriodQuery["startDate"];
    readonly end: AnalyticsPeriodQuery["endDate"];
  }
): AnalyticsPeriodQuery {
  return {
    db: input.db,
    userId: input.userId,
    startDate: range.start,
    endDate: range.end,
  };
}

export function createAnalyticsService({
  getNow = () => new Date(),
  getExpenseTransactionsForPeriod: loadExpenseTransactions = getExpenseTransactionsForPeriod,
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
      const currentQuery = buildPeriodQuery({ db, userId }, current);
      const previousQuery = buildPeriodQuery({ db, userId }, previous);

      const currentIncomeExpense = loadIncomeExpense(currentQuery);
      const previousIncomeExpense = loadIncomeExpense(previousQuery);
      const currentSpending = loadSpendingByCategory(currentQuery);
      const previousSpending = loadSpendingByCategory(previousQuery);
      const categoryExpenses = loadExpenseTransactions(currentQuery);
      const currentPeriodDeltaInput = buildPeriodDeltaInput(
        currentIncomeExpense.expenses,
        currentSpending
      );
      const previousPeriodDeltaInput = buildPeriodDeltaInput(
        previousIncomeExpense.expenses,
        previousSpending
      );

      return {
        incomeExpense: deriveIncomeExpense(
          currentIncomeExpense.income,
          currentIncomeExpense.expenses
        ),
        categoryBreakdown: deriveCategoryBreakdown(currentSpending, currentIncomeExpense.expenses),
        categoryExpenses,
        periodDelta: derivePeriodDelta(currentPeriodDeltaInput, previousPeriodDeltaInput),
      };
    },
  };
}
