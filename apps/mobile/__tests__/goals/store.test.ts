import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGoal,
  initializeGoalSession,
  loadGoalsForUser,
  selectGoal,
  useGoalStore,
} from "@/features/goals/store";
import type { UserId } from "@/shared/types/branded";

const mockLoadGoals = vi.fn();
const mockLoadGoalContributions = vi.fn();
const mockCommit = vi.fn();

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
    const deferred =
      createDeferred<
        readonly [
          {
            readonly goal: {
              readonly id: string;
              readonly name: string;
            };
            readonly currentAmount: number;
            readonly progress: {
              readonly percentComplete: number;
              readonly remaining: number;
              readonly isComplete: boolean;
            };
            readonly projection: {
              readonly monthsToGo: number | null;
              readonly projectedDate: Date | null;
              readonly confidence: "none" | "low" | "medium" | "high";
              readonly netMonthlySavings: number;
            };
            readonly installments: {
              readonly current: number;
              readonly total: number;
            };
            readonly paceGuidance: null;
          },
        ]
      >();
    mockLoadGoals.mockReturnValueOnce(deferred.promise);

    initializeGoalSession("user-1" as UserId);
    const load = loadGoalsForUser({} as never, "user-1" as UserId);

    initializeGoalSession("user-2" as UserId);
    deferred.resolve([
      {
        goal: { id: "goal-1", name: "Trip" },
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
      },
    ]);

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
});
