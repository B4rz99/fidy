import { describe, expect, it, vi } from "vitest";
import { createAnalyticsService } from "@/features/analytics/services/create-analytics-service";
import type { CategoryId, CopAmount, UserId } from "@/shared/types/branded";

const mockGetIncomeExpenseForPeriod = vi.fn<(...args: any[]) => any>();
const mockGetSpendingByCategoryForPeriod = vi.fn<(...args: any[]) => any>();
const mockGetExpenseTransactionsForPeriod = vi.fn<(...args: any[]) => any>();
const testNow = () => new Date(2026, 2, 23);

const currentIncomeExpense = {
  income: 500000 as CopAmount,
  expenses: 200000 as CopAmount,
};

const previousIncomeExpense = {
  income: 450000 as CopAmount,
  expenses: 100000 as CopAmount,
};

const currentSpending = [
  { categoryId: "food" as CategoryId, total: 150000 as CopAmount },
  { categoryId: "transport" as CategoryId, total: 50000 as CopAmount },
];

const previousSpending = [{ categoryId: "food" as CategoryId, total: 100000 as CopAmount }];

const currentCategoryExpenses = [
  {
    id: "tx-food-2",
    categoryId: "food" as CategoryId,
    amount: 50000 as CopAmount,
    description: "Dinner",
    date: new Date(2026, 2, 22),
  },
];

const expectedIncomeExpenseCalls: ReadonlyArray<
  readonly [callIndex: number, startDate: string, endDate: string]
> = [
  [1, "2026-02-22", "2026-03-23"],
  [2, "2026-01-23", "2026-02-21"],
];

const expectedSnapshot = {
  incomeExpense: {
    income: 500000,
    expenses: 200000,
    net: 300000,
    netIsPositive: true,
  },
  categoryBreakdown: [
    { categoryId: "food", total: 150000, percent: 75 },
    { categoryId: "transport", total: 50000, percent: 25 },
  ],
  categoryExpenses: currentCategoryExpenses,
  periodDelta: {
    totalDelta: 100000,
    totalDeltaPercent: 100,
    spendingIncreased: true,
    categoryDeltas: [
      { categoryId: "food", delta: 50000, deltaPercent: 50, trend: "increased" },
      { categoryId: "transport", delta: 50000, deltaPercent: 100, trend: "increased" },
    ],
  },
};

describe("analytics service", () => {
  it("builds the analytics snapshot for the selected period", async () => {
    mockGetIncomeExpenseForPeriod
      .mockReturnValueOnce(currentIncomeExpense)
      .mockReturnValueOnce(previousIncomeExpense);
    mockGetSpendingByCategoryForPeriod
      .mockReturnValueOnce(currentSpending)
      .mockReturnValueOnce(previousSpending);
    mockGetExpenseTransactionsForPeriod.mockReturnValueOnce(currentCategoryExpenses);
    const service = createAnalyticsService({
      getNow: testNow,
      getExpenseTransactionsForPeriod: mockGetExpenseTransactionsForPeriod,
      getIncomeExpenseForPeriod: mockGetIncomeExpenseForPeriod,
      getSpendingByCategoryForPeriod: mockGetSpendingByCategoryForPeriod,
    });

    const snapshot = await service.loadSnapshot({
      db: {} as never,
      userId: "user-1" as UserId,
      period: "M",
    });

    expectedIncomeExpenseCalls.forEach(([callIndex, startDate, endDate]) => {
      expect(mockGetIncomeExpenseForPeriod).toHaveBeenNthCalledWith(callIndex, {
        db: expect.anything(),
        userId: "user-1",
        startDate,
        endDate,
      });
    });
    expect(mockGetExpenseTransactionsForPeriod).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: "user-1",
      startDate: "2026-02-22",
      endDate: "2026-03-23",
    });
    expect(snapshot).toEqual(expectedSnapshot);
  });
});
