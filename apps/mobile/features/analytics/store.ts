import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import { captureError } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type {
  AnalyticsPeriod,
  CategoryBreakdownItem,
  IncomeExpenseResult,
  PeriodDelta,
} from "./lib/derive";
import type { AnalyticsSnapshot } from "./services/create-analytics-service";
import { createAnalyticsService } from "./services/create-analytics-service";

let loadAnalyticsRequestId = 0;

const analyticsService = createAnalyticsService();

type AnalyticsState = {
  readonly activeUserId: UserId | null;
  readonly period: AnalyticsPeriod;
  readonly incomeExpense: IncomeExpenseResult | null;
  readonly categoryBreakdown: readonly CategoryBreakdownItem[];
  readonly periodDelta: PeriodDelta | null;
  readonly isLoading: boolean;
};

type AnalyticsActions = {
  beginSession(userId: UserId): void;
  setPeriod(period: AnalyticsPeriod): void;
  setSnapshot(snapshot: AnalyticsSnapshot): void;
  setIsLoading(isLoading: boolean): void;
};

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>((set) => ({
  activeUserId: null,
  period: "M",
  incomeExpense: null,
  categoryBreakdown: [],
  periodDelta: null,
  isLoading: false,

  beginSession: (userId) =>
    set({
      activeUserId: userId,
      incomeExpense: null,
      categoryBreakdown: [],
      periodDelta: null,
      isLoading: false,
    }),

  setPeriod: (period) => set({ period }),

  setSnapshot: (snapshot) =>
    set({
      incomeExpense: snapshot.incomeExpense,
      categoryBreakdown: snapshot.categoryBreakdown,
      periodDelta: snapshot.periodDelta,
      isLoading: false,
    }),

  setIsLoading: (isLoading) => set({ isLoading }),
}));

function isCurrentAnalyticsRequest(
  requestId: number,
  userId: UserId,
  period: AnalyticsPeriod
): boolean {
  return (
    loadAnalyticsRequestId === requestId &&
    useAnalyticsStore.getState().activeUserId === userId &&
    useAnalyticsStore.getState().period === period
  );
}

export function initializeAnalyticsSession(userId: UserId): void {
  loadAnalyticsRequestId += 1;
  useAnalyticsStore.getState().beginSession(userId);
}

export async function loadAnalyticsForUser(db: AnyDb, userId: UserId): Promise<void> {
  const period = useAnalyticsStore.getState().period;
  const requestId = ++loadAnalyticsRequestId;
  useAnalyticsStore.getState().setIsLoading(true);

  try {
    const snapshot = await analyticsService.loadSnapshot({ db, userId, period });
    if (!isCurrentAnalyticsRequest(requestId, userId, period)) {
      if (loadAnalyticsRequestId === requestId) {
        useAnalyticsStore.getState().setIsLoading(false);
      }
      return;
    }
    useAnalyticsStore.getState().setSnapshot(snapshot);
  } catch (error) {
    captureError(error);
    if (loadAnalyticsRequestId === requestId) {
      useAnalyticsStore.getState().setIsLoading(false);
    }
  }
}

export async function selectAnalyticsPeriod(
  db: AnyDb,
  userId: UserId,
  period: AnalyticsPeriod
): Promise<void> {
  useAnalyticsStore.getState().setPeriod(period);
  await loadAnalyticsForUser(db, userId);
}
