import { describe, expect, it, vi } from "vitest";
import { createAnalyticsService } from "@/features/analytics/services/create-analytics-service";
import type { CategoryId, CopAmount, UserId } from "@/shared/types/branded";

const mockGetIncomeExpenseForPeriod = vi.fn();
const mockGetSpendingByCategoryForPeriod = vi.fn();

describe("analytics service", () => {
  it("builds the analytics snapshot for the selected period", async () => {
    mockGetIncomeExpenseForPeriod
      .mockReturnValueOnce({
        income: 500000 as CopAmount,
        expenses: 200000 as CopAmount,
      })
      .mockReturnValueOnce({
        income: 450000 as CopAmount,
        expenses: 100000 as CopAmount,
      });
    mockGetSpendingByCategoryForPeriod
      .mockReturnValueOnce([
        { categoryId: "food" as CategoryId, total: 150000 as CopAmount },
        { categoryId: "transport" as CategoryId, total: 50000 as CopAmount },
      ])
      .mockReturnValueOnce([{ categoryId: "food" as CategoryId, total: 100000 as CopAmount }]);

    const service = createAnalyticsService({
      getNow: () => new Date(2026, 2, 23),
      getIncomeExpenseForPeriod: mockGetIncomeExpenseForPeriod,
      getSpendingByCategoryForPeriod: mockGetSpendingByCategoryForPeriod,
    });

    const snapshot = await service.loadSnapshot({
      db: {} as never,
      userId: "user-1" as UserId,
      period: "M",
    });

    expect(mockGetIncomeExpenseForPeriod).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "user-1",
      "2026-02-22",
      "2026-03-23"
    );
    expect(mockGetIncomeExpenseForPeriod).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "user-1",
      "2026-01-23",
      "2026-02-21"
    );
    expect(snapshot).toEqual({
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
      periodDelta: {
        totalDelta: 100000,
        totalDeltaPercent: 100,
        spendingIncreased: true,
        categoryDeltas: [
          { categoryId: "food", delta: 50000, deltaPercent: 50, increased: true },
          { categoryId: "transport", delta: 50000, deltaPercent: 100, increased: true },
        ],
      },
    });
  });
});
