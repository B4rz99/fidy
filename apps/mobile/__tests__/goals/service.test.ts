import { describe, expect, it, vi } from "vitest";
import { createGoalQueryService } from "@/features/goals/services/create-goal-query-service";
import type { UserId } from "@/shared/types/branded";

const mockGetGoalsForUser = vi.fn();
const mockGetGoalCurrentAmount = vi.fn();
const mockGetMonthlyTotalsByType = vi.fn();
const mockGetContributionMonthCount = vi.fn();
const mockGetContributionsForGoal = vi.fn();

describe("goal query service", () => {
  it("builds goal progress snapshots for the active user", async () => {
    mockGetGoalsForUser.mockReturnValue([
      {
        id: "goal-1",
        userId: "user-1",
        name: "Trip",
        type: "savings",
        targetAmount: 900000,
        targetDate: "2026-12-31",
        interestRatePercent: null,
        iconName: null,
        colorHex: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      },
    ]);
    mockGetGoalCurrentAmount.mockReturnValue(300000);
    mockGetMonthlyTotalsByType.mockReturnValue([
      { month: "2026-03", type: "income", total: 1200000 },
      { month: "2026-03", type: "expense", total: 300000 },
      { month: "2026-02", type: "income", total: 1100000 },
      { month: "2026-02", type: "expense", total: 400000 },
      { month: "2026-01", type: "income", total: 1000000 },
      { month: "2026-01", type: "expense", total: 350000 },
    ]);
    mockGetContributionMonthCount.mockReturnValue(2);

    const service = createGoalQueryService({
      getGoalsForUser: mockGetGoalsForUser,
      getGoalCurrentAmount: mockGetGoalCurrentAmount,
      getMonthlyTotalsByType: mockGetMonthlyTotalsByType,
      getContributionMonthCount: mockGetContributionMonthCount,
      getContributionsForGoal: mockGetContributionsForGoal,
      getToday: () => new Date("2026-03-15T00:00:00.000Z"),
    });

    const snapshot = await service.loadGoals({
      db: {} as never,
      userId: "user-1" as UserId,
    });

    expect(mockGetGoalsForUser).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(mockGetMonthlyTotalsByType).toHaveBeenCalledWith(expect.anything(), "user-1", 3);
    expect(snapshot).toEqual([
      expect.objectContaining({
        goal: expect.objectContaining({ id: "goal-1", name: "Trip" }),
        currentAmount: 300000,
        progress: expect.objectContaining({
          percentComplete: 33,
          remaining: 600000,
          isComplete: false,
        }),
        projection: expect.objectContaining({
          confidence: "high",
          monthsToGo: 1,
          netMonthlySavings: 750000,
          projectedDate: expect.any(Date),
        }),
        installments: {
          current: 2,
          total: 2,
        },
      }),
    ]);
  });

  it("loads contribution history for the selected goal", async () => {
    mockGetContributionsForGoal.mockReturnValue([
      {
        id: "contrib-1",
        goalId: "goal-1",
        userId: "user-1",
        amount: 50000,
        note: "bonus",
        date: "2026-03-10",
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z",
        deletedAt: null,
      },
    ]);

    const service = createGoalQueryService({
      getGoalsForUser: mockGetGoalsForUser,
      getGoalCurrentAmount: mockGetGoalCurrentAmount,
      getMonthlyTotalsByType: mockGetMonthlyTotalsByType,
      getContributionMonthCount: mockGetContributionMonthCount,
      getContributionsForGoal: mockGetContributionsForGoal,
    });

    const contributions = await service.loadGoalContributions({
      db: {} as never,
      goalId: "goal-1",
    });

    expect(mockGetContributionsForGoal).toHaveBeenCalledWith(expect.anything(), "goal-1");
    expect(contributions).toEqual([expect.objectContaining({ id: "contrib-1", note: "bonus" })]);
  });
});
