import { beforeEach, expect, it, vi } from "vitest";
import type { GoalUpdateInput } from "@/features/goals/schema";
import { createGoalMutationService } from "@/features/goals/services/create-goal-mutation-service";
import { createGoalQueryService } from "@/features/goals/services/create-goal-query-service";
import type { UserId } from "@/shared/types/branded";

const mockGetGoalsForUser = vi.fn();
const mockGetGoalCurrentAmount = vi.fn();
const mockGetMonthlyTotalsByType = vi.fn();
const mockGetContributionMonthCount = vi.fn();
const mockGetContributionsForGoal = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const goalRow = {
  id: "goal-1",
  userId: "user-1",
  name: "Trip",
  type: "savings" as const,
  targetAmount: 900000,
  targetDate: "2026-12-31",
  interestRatePercent: null,
  iconName: null,
  colorHex: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

const contributionRow = {
  id: "contrib-1",
  goalId: "goal-1",
  userId: "user-1",
  amount: 50000,
  note: "bonus",
  date: "2026-03-10",
  createdAt: "2026-03-10T00:00:00.000Z",
  updatedAt: "2026-03-10T00:00:00.000Z",
  deletedAt: null,
};

const monthlyTotals = [
  { month: "2026-03", type: "income" as const, total: 1200000 },
  { month: "2026-03", type: "expense" as const, total: 300000 },
  { month: "2026-02", type: "income" as const, total: 1100000 },
  { month: "2026-02", type: "expense" as const, total: 400000 },
  { month: "2026-01", type: "income" as const, total: 1000000 },
  { month: "2026-01", type: "expense" as const, total: 350000 },
];

const expectedGoalSnapshot = [
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
];

const expectedGoalSaveCommand = {
  kind: "goal.save",
  row: {
    id: "goal-generated",
    userId: "user-1",
    name: "Trip",
    type: "savings",
    targetAmount: 900000,
    targetDate: null,
    interestRatePercent: null,
    iconName: null,
    colorHex: null,
    createdAt: "2026-04-20T12:30:00.000Z",
    updatedAt: "2026-04-20T12:30:00.000Z",
    deletedAt: null,
  },
};

function createQueryService() {
  return createGoalQueryService({
    getGoalsForUser: mockGetGoalsForUser,
    getGoalCurrentAmount: mockGetGoalCurrentAmount,
    getMonthlyTotalsByType: mockGetMonthlyTotalsByType,
    getContributionMonthCount: mockGetContributionMonthCount,
    getContributionsForGoal: mockGetContributionsForGoal,
    getToday: () => new Date("2026-03-15T00:00:00.000Z"),
  });
}

function createMilestoneService() {
  const insertNotification = vi.fn().mockResolvedValue(true);
  const schedulePush = vi.fn();
  const trackMilestoneReached = vi.fn();

  return {
    insertNotification,
    schedulePush,
    trackMilestoneReached,
    service: createGoalMutationService({
      db: {} as never,
      userId: "user-1" as UserId,
      commit: vi.fn().mockResolvedValue(true),
      insertNotification,
      schedulePush,
      translateMilestoneTitle: ({ goalName, milestone }) => `${goalName}:${milestone}`,
      translateMilestoneBody: ({ milestone }) => `Reached ${milestone}`,
      trackMilestoneReached,
    }),
  };
}

function expectMilestoneNotifications(insertNotification: ReturnType<typeof vi.fn>) {
  expect(insertNotification).toHaveBeenNthCalledWith(
    1,
    expect.anything(),
    "user-1",
    expect.objectContaining({
      dedupKey: "goal_milestone:goal-1:25",
      goalId: "goal-1",
    })
  );
  expect(insertNotification).toHaveBeenNthCalledWith(
    2,
    expect.anything(),
    "user-1",
    expect.objectContaining({
      dedupKey: "goal_milestone:goal-1:50",
      goalId: "goal-1",
    })
  );
}

function expectMilestonePushes(
  schedulePush: ReturnType<typeof vi.fn>,
  trackMilestoneReached: ReturnType<typeof vi.fn>
) {
  expect(schedulePush).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      title: "Trip:25",
      body: "Reached 25",
      data: { route: "/goal-detail?goalId=goal-1" },
      preferenceKey: "goalMilestones",
    })
  );
  expect(schedulePush).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      title: "Trip:50",
      body: "Reached 50",
    })
  );
  expect(trackMilestoneReached).toHaveBeenCalledTimes(2);
}

it("builds goal progress snapshots for the active user", async () => {
  mockGetGoalsForUser.mockReturnValue([goalRow]);
  mockGetGoalCurrentAmount.mockReturnValue(300000);
  mockGetMonthlyTotalsByType.mockReturnValue(monthlyTotals);
  mockGetContributionMonthCount.mockReturnValue(2);

  const snapshot = await createQueryService().loadGoals({
    db: {} as never,
    userId: "user-1" as UserId,
  });

  expect(mockGetGoalsForUser).toHaveBeenCalledWith(expect.anything(), "user-1");
  expect(mockGetMonthlyTotalsByType).toHaveBeenCalledWith(expect.anything(), "user-1", 3);
  expect(snapshot).toEqual(expectedGoalSnapshot);
});

it("loads contribution history for the selected goal", async () => {
  mockGetContributionsForGoal.mockReturnValue([contributionRow]);

  const contributions = await createQueryService().loadGoalContributions({
    db: {} as never,
    goalId: "goal-1",
  });

  expect(mockGetContributionsForGoal).toHaveBeenCalledWith(expect.anything(), "goal-1");
  expect(contributions).toEqual([expect.objectContaining({ id: "contrib-1", note: "bonus" })]);
});

it("commits normalized goal saves and tracks successful creates", async () => {
  const commit = vi.fn().mockResolvedValue(true);
  const trackCreated = vi.fn();

  const service = createGoalMutationService({
    db: {} as never,
    userId: "user-1" as UserId,
    commit,
    now: () => new Date("2026-04-20T12:30:00.000Z"),
    createGoalId: () => "goal-generated",
    trackCreated,
  });

  await expect(
    service.createGoal({
      name: "Trip",
      type: "savings",
      targetAmount: 900000,
    })
  ).resolves.toBe(true);

  expect(commit).toHaveBeenCalledWith(expectedGoalSaveCommand);
  expect(trackCreated).toHaveBeenCalledTimes(1);
});

it("commits validated goal updates", async () => {
  const commit = vi.fn().mockResolvedValue(true);
  const service = createGoalMutationService({
    db: {} as never,
    userId: "user-1" as UserId,
    commit,
    now: () => new Date("2026-04-20T12:30:00.000Z"),
  });

  await expect(
    service.updateGoal("goal-1", {
      targetDate: null,
      colorHex: "#00AAFF",
    })
  ).resolves.toBe(true);

  expect(commit).toHaveBeenCalledWith({
    kind: "goal.update",
    goalId: "goal-1",
    data: {
      targetDate: null,
      colorHex: "#00AAFF",
    },
    now: "2026-04-20T12:30:00.000Z",
  });
});

it("rejects invalid goal updates before they reach the mutation boundary", async () => {
  const commit = vi.fn().mockResolvedValue(true);
  const service = createGoalMutationService({
    db: {} as never,
    userId: "user-1" as UserId,
    commit,
  });

  await expect(service.updateGoal("goal-1", { colorHex: "blue" } as GoalUpdateInput)).resolves.toBe(
    false
  );

  expect(commit).not.toHaveBeenCalled();
});

it("publishes milestone notifications through the injected side-effect boundary", async () => {
  const { insertNotification, schedulePush, trackMilestoneReached, service } =
    createMilestoneService();

  await service.notifyMilestones({
    goalId: "goal-1",
    goalName: "Trip",
    milestones: [25, 50],
  });

  expectMilestoneNotifications(insertNotification);
  expectMilestonePushes(schedulePush, trackMilestoneReached);
});

it("skips milestone push and analytics when the notification insert is deduped", async () => {
  const { insertNotification, schedulePush, trackMilestoneReached, service } =
    createMilestoneService();
  insertNotification.mockResolvedValue(false);

  await service.notifyMilestones({
    goalId: "goal-1",
    goalName: "Trip",
    milestones: [25],
  });

  expect(insertNotification).toHaveBeenCalledTimes(1);
  expect(schedulePush).not.toHaveBeenCalled();
  expect(trackMilestoneReached).not.toHaveBeenCalled();
});

it("squashes milestone notification failures", async () => {
  const { insertNotification, schedulePush, trackMilestoneReached, service } =
    createMilestoneService();
  insertNotification.mockRejectedValue(new Error("notification unavailable"));

  await expect(
    service.notifyMilestones({
      goalId: "goal-1",
      goalName: "Trip",
      milestones: [25],
    })
  ).resolves.toBeUndefined();

  expect(insertNotification).toHaveBeenCalledTimes(1);
  expect(schedulePush).not.toHaveBeenCalled();
  expect(trackMilestoneReached).not.toHaveBeenCalled();
});
