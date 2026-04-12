// biome-ignore-all lint/suspicious/noExplicitAny: focused store test uses lightweight mocks
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryId, CopAmount, Month, UserId } from "@/shared/types/branded";

const mockRefreshMonth = vi.fn();
const mockLoadAutoSuggestions = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockSubscribe = vi.fn(() => vi.fn());

vi.mock("@/features/budget/lib/monitoring", () => ({
  createBudgetMonitoringModule: vi.fn(() => ({
    refreshMonth: mockRefreshMonth,
    loadAutoSuggestions: mockLoadAutoSuggestions,
    acknowledgeAlert: mockAcknowledgeAlert,
  })),
}));

vi.mock("@/features/notifications", () => ({
  useNotificationStore: {
    getState: () => ({
      insertNotification: vi.fn(),
    }),
  },
}));

vi.mock("@/features/settings", () => ({
  useSettingsStore: {
    getState: () => ({
      notificationPreferences: { budgetAlerts: true },
    }),
  },
}));

vi.mock("@/features/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/transactions")>();
  return {
    ...actual,
    CATEGORY_MAP: {},
    useTransactionStore: {
      subscribe: mockSubscribe,
    },
  };
});

vi.mock("@/shared/i18n", () => ({
  getCategoryLabel: vi.fn((category: { id?: string }, _locale: string) => category.id ?? "unknown"),
  useLocaleStore: {
    getState: () => ({ locale: "es" }),
  },
}));

vi.mock("@/features/budget/lib/notifications", () => ({
  scheduleBudgetAlert: vi.fn(),
}));

const USER_ID = "user-1" as UserId;
const mockDb = {} as any;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function getStore() {
  const { useBudgetStore } = await import("@/features/budget/store");
  return useBudgetStore;
}

describe("useBudgetStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("ignores stale budget refresh results after the month changes", async () => {
    const staleSnapshot = {
      budgets: [{ id: "budget-march", categoryId: "food", month: "2026-03" as Month }] as any[],
      budgetProgress: [],
      summary: { totalBudget: 100000, totalSpent: 85000, percentUsed: 85 },
      autoSuggestions: [],
      pendingAlerts: [],
      pendingPermissionRequest: false,
    };
    const freshSnapshot = {
      budgets: [
        { id: "budget-april", categoryId: "transport", month: "2026-04" as Month },
      ] as any[],
      budgetProgress: [],
      summary: { totalBudget: 120000, totalSpent: 10000, percentUsed: 8 },
      autoSuggestions: [],
      pendingAlerts: [],
      pendingPermissionRequest: false,
    };
    const deferredMarch = createDeferred<typeof staleSnapshot>();

    mockRefreshMonth.mockImplementation(({ month }: { month: Month }) =>
      month === ("2026-03" as Month) ? deferredMarch.promise : Promise.resolve(freshSnapshot)
    );

    const store = await getStore();
    store.getState().initStore(mockDb, USER_ID);
    store.setState({ currentMonth: "2026-03" as Month });

    const staleLoad = store.getState().loadBudgets();

    store.setState({ currentMonth: "2026-04" as Month });
    const freshLoad = store.getState().loadBudgets();

    await freshLoad;
    deferredMarch.resolve(staleSnapshot);
    await staleLoad;

    expect(store.getState().currentMonth).toBe("2026-04");
    expect(store.getState().budgets).toEqual(freshSnapshot.budgets);
    expect(store.getState().summary).toEqual(freshSnapshot.summary);
    expect(store.getState().isLoading).toBe(false);
  });

  it("loads auto suggestions without triggering the full refresh path", async () => {
    const suggestions = [
      {
        categoryId: "entertainment" as CategoryId,
        suggestedAmount: 44000 as CopAmount,
      },
    ];
    mockLoadAutoSuggestions.mockReturnValue(suggestions);

    const store = await getStore();
    store.getState().initStore(mockDb, USER_ID);
    store.setState({
      currentMonth: "2026-03" as Month,
      budgets: [{ id: "budget-1", categoryId: "food" as CategoryId }] as any[],
    });

    store.getState().loadAutoSuggestions();

    expect(mockLoadAutoSuggestions).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      month: "2026-03",
      existingCategoryIds: new Set(["food" as CategoryId]),
    });
    expect(mockRefreshMonth).not.toHaveBeenCalled();
    expect(store.getState().autoSuggestions).toEqual(suggestions);
  });
});
