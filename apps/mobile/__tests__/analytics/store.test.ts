import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeAnalyticsSession,
  loadAnalyticsForUser,
  selectAnalyticsPeriod,
  useAnalyticsStore,
} from "@/features/analytics/store";
import type { CategoryId, CopAmount, UserId } from "@/shared/types/branded";

const mockLoadSnapshot = vi.fn();

vi.mock("@/features/analytics/services/create-analytics-service", () => ({
  createAnalyticsService: () => ({
    loadSnapshot: (...args: unknown[]) => mockLoadSnapshot(...args),
  }),
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("analytics store boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAnalyticsStore.setState({
      activeUserId: null,
      period: "M",
      incomeExpense: null,
      categoryBreakdown: [],
      periodDelta: null,
      isLoading: false,
    });
  });

  it("drops stale analytics results after the active user changes", async () => {
    const deferred = createDeferred<{
      incomeExpense: {
        income: CopAmount;
        expenses: CopAmount;
        net: CopAmount;
        netIsPositive: boolean;
      };
      categoryBreakdown: readonly { categoryId: CategoryId; total: CopAmount; percent: number }[];
      periodDelta: {
        totalDelta: CopAmount;
        totalDeltaPercent: number;
        spendingIncreased: boolean;
        categoryDeltas: readonly {
          categoryId: CategoryId;
          delta: CopAmount;
          deltaPercent: number;
          increased: boolean;
        }[];
      };
    }>();
    mockLoadSnapshot.mockReturnValueOnce(deferred.promise);

    initializeAnalyticsSession("user-1" as UserId);
    const load = loadAnalyticsForUser({} as never, "user-1" as UserId);

    initializeAnalyticsSession("user-2" as UserId);
    deferred.resolve({
      incomeExpense: {
        income: 500000 as CopAmount,
        expenses: 200000 as CopAmount,
        net: 300000 as CopAmount,
        netIsPositive: true,
      },
      categoryBreakdown: [
        { categoryId: "food" as CategoryId, total: 200000 as CopAmount, percent: 100 },
      ],
      periodDelta: {
        totalDelta: 100000 as CopAmount,
        totalDeltaPercent: 100,
        spendingIncreased: true,
        categoryDeltas: [],
      },
    });

    await load;

    expect(useAnalyticsStore.getState()).toMatchObject({
      activeUserId: "user-2",
      incomeExpense: null,
      categoryBreakdown: [],
      periodDelta: null,
      isLoading: false,
    });
  });

  it("updates the selected period through the explicit boundary", async () => {
    mockLoadSnapshot.mockResolvedValueOnce({
      incomeExpense: {
        income: 300000 as CopAmount,
        expenses: 100000 as CopAmount,
        net: 200000 as CopAmount,
        netIsPositive: true,
      },
      categoryBreakdown: [],
      periodDelta: {
        totalDelta: 0 as CopAmount,
        totalDeltaPercent: 0,
        spendingIncreased: false,
        categoryDeltas: [],
      },
    });

    initializeAnalyticsSession("user-1" as UserId);
    await selectAnalyticsPeriod({} as never, "user-1" as UserId, "Q");

    expect(mockLoadSnapshot).toHaveBeenCalledWith({
      db: expect.anything(),
      userId: "user-1",
      period: "Q",
    });
    expect(useAnalyticsStore.getState()).toMatchObject({
      activeUserId: "user-1",
      period: "Q",
      incomeExpense: expect.objectContaining({ income: 300000 }),
      isLoading: false,
    });
  });
});
