import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addContribution,
  createGoal,
  initializeGoalSession,
  loadGoalsForUser,
  selectGoal,
  useGoalStore,
} from "@/features/goals/store";
import type { GoalWithProgress } from "@/features/goals/types";
import { insertNotificationRecord } from "@/features/notifications";
import type { UserId } from "@/shared/types/branded";

const mockLoadGoals = vi.fn();
const mockLoadGoalContributions = vi.fn();
const mockCommit = vi.fn();

const baseGoalSnapshot: GoalWithProgress = {
  goal: {
    id: "goal-1",
    userId: "user-1",
    name: "Trip",
    type: "savings",
    targetAmount: 1000000,
    targetDate: null,
    interestRatePercent: null,
    iconName: null,
    colorHex: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    deletedAt: null,
  },
  currentAmount: 250000,
  progress: { percentComplete: 25, remaining: 750000, isComplete: false },
  projection: {
    monthsToGo: 2,
    projectedDate: new Date("2026-06-01T00:00:00.000Z"),
    confidence: "high",
    netMonthlySavings: 400000,
  },
  installments: { current: 1, total: 3 },
  paceGuidance: null,
};

vi.mock("@/features/goals/services/create-goal-query-service", () => ({
  createGoalQueryService: () => ({
    loadGoals: (...args: unknown[]) => mockLoadGoals(...args),
    loadGoalContributions: (...args: unknown[]) => mockLoadGoalContributions(...args),
  }),
}));

vi.mock("@/mutations", () => ({
  createWriteThroughMutationModule: () => ({
    commit: mockCommit,
  }),
}));

vi.mock("@/features/notifications", () => ({
  insertNotificationRecord: vi.fn(),
  scheduleLocalPush: vi.fn(),
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib")>("@/shared/lib");
  return {
    ...actual,
    captureError: vi.fn(),
    generateId: vi.fn(() => "goal-generated"),
    toIsoDateTime: vi.fn(() => "2026-04-18T10:00:00.000Z"),
    trackGoalContributionAdded: vi.fn(),
    trackGoalCreated: vi.fn(),
    trackGoalMilestoneReached: vi.fn(),
  };
});

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const createGoalSnapshot = (progress: GoalWithProgress["progress"]): GoalWithProgress => ({
  ...baseGoalSnapshot,
  currentAmount: baseGoalSnapshot.goal.targetAmount - progress.remaining,
  progress,
});

const initialGoalSnapshot = createGoalSnapshot({
  percentComplete: 20,
  remaining: 800000,
  isComplete: false,
});

const updatedGoalSnapshot = createGoalSnapshot({
  percentComplete: 50,
  remaining: 500000,
  isComplete: false,
});

const createGoalLoadDeferred = () => createDeferred<readonly GoalWithProgress[]>();

describe("goal store boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGoalStore.setState({
      activeUserId: null,
      goals: [],
      selectedGoalId: null,
      selectedGoalContributions: [],
      isLoading: false,
    });
  });

  it("drops stale goal results after the active user changes", async () => {
    const deferred = createGoalLoadDeferred();
    mockLoadGoals.mockReturnValueOnce(deferred.promise);

    initializeGoalSession("user-1" as UserId);
    const load = loadGoalsForUser({} as never, "user-1" as UserId);

    initializeGoalSession("user-2" as UserId);
    deferred.resolve([baseGoalSnapshot]);

    await load;

    expect(useGoalStore.getState()).toMatchObject({
      activeUserId: "user-2",
      goals: [],
      isLoading: false,
    });
  });

  it("loads contributions for the selected goal through the explicit boundary", async () => {
    mockLoadGoalContributions.mockResolvedValueOnce([
      {
        id: "contrib-1",
        goalId: "goal-1",
        userId: "user-1",
        amount: 50000,
        note: "bonus",
        date: "2026-04-10",
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
        deletedAt: null,
      },
    ]);

    initializeGoalSession("user-1" as UserId);
    await selectGoal({} as never, "user-1" as UserId, "goal-1");

    expect(mockLoadGoalContributions).toHaveBeenCalledWith({
      db: expect.anything(),
      goalId: "goal-1",
    });
    expect(useGoalStore.getState()).toMatchObject({
      activeUserId: "user-1",
      selectedGoalId: "goal-1",
      selectedGoalContributions: [expect.objectContaining({ id: "contrib-1", note: "bonus" })],
    });
  });

  it("drops stale create-goal completions after the active user changes", async () => {
    const deferredCommit = createDeferred<{ success: true }>();
    mockCommit.mockReturnValueOnce(deferredCommit.promise);

    initializeGoalSession("user-1" as UserId);
    const create = createGoal({} as never, "user-1" as UserId, {
      name: "Trip",
      type: "savings",
      targetAmount: 900000,
    });

    initializeGoalSession("user-2" as UserId);
    deferredCommit.resolve({ success: true });

    await expect(create).resolves.toBe(false);
    expect(useGoalStore.getState()).toMatchObject({
      activeUserId: "user-2",
      goals: [],
    });
  });

  it("does not fail addContribution when milestone notification publishing rejects", async () => {
    mockCommit.mockResolvedValueOnce({ success: true });
    mockLoadGoals.mockResolvedValueOnce([updatedGoalSnapshot]);
    vi.mocked(insertNotificationRecord).mockRejectedValue(new Error("notifications offline"));

    initializeGoalSession("user-1" as UserId);
    useGoalStore.setState({
      activeUserId: "user-1" as UserId,
      goals: [initialGoalSnapshot],
      selectedGoalId: null,
      selectedGoalContributions: [],
      isLoading: false,
    });

    await expect(
      addContribution({} as never, "user-1" as UserId, {
        goalId: "goal-1",
        amount: 250000,
        date: "2026-04-18",
      })
    ).resolves.toBe(true);

    expect(mockCommit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "goalContribution.save" })
    );
    expect(useGoalStore.getState().goals).toEqual([updatedGoalSnapshot]);
  });
});
