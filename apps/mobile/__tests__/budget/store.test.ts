// biome-ignore-all lint/suspicious/noExplicitAny: focused store test uses lightweight mocks
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryId, CopAmount, Month, UserId } from "@/shared/types/branded";

const mockCreateBudgetMonitoringModule = vi.fn();
const mockRefreshMonth = vi.fn();
const mockLoadAutoSuggestions = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockInsertNotificationRecord = vi.fn();
const mockSubscribe = vi.fn(() => vi.fn());

vi.mock("@/features/budget/lib/monitoring", () => ({
  createBudgetMonitoringModule: mockCreateBudgetMonitoringModule.mockImplementation(() => ({
    refreshMonth: mockRefreshMonth,
    loadAutoSuggestions: mockLoadAutoSuggestions,
    acknowledgeAlert: mockAcknowledgeAlert,
  })),
}));

vi.mock("@/features/notifications", () => ({
  insertNotificationRecord: (...args: unknown[]) => mockInsertNotificationRecord(...args),
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
    // biome-ignore lint/style/useNamingConvention: mock matches exported constant name
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

  it("clears loading when context changes without starting a newer refresh", async () => {
    const deferredSnapshot = createDeferred<{
      budgets: any[];
      budgetProgress: any[];
      summary: { totalBudget: number; totalSpent: number; percentUsed: number };
      autoSuggestions: any[];
      pendingAlerts: any[];
      pendingPermissionRequest: boolean;
    }>();

    mockRefreshMonth.mockReturnValueOnce(deferredSnapshot.promise);

    const store = await getStore();
    store.getState().initStore(mockDb, USER_ID);
    store.setState({ currentMonth: "2026-03" as Month });

    const load = store.getState().loadBudgets();

    store.getState().initStore(mockDb, "user-2" as UserId);
    deferredSnapshot.resolve({
      budgets: [],
      budgetProgress: [],
      summary: { totalBudget: 0, totalSpent: 0, percentUsed: 0 },
      autoSuggestions: [],
      pendingAlerts: [],
      pendingPermissionRequest: false,
    });
    await load;

    expect(store.getState().isLoading).toBe(false);
  });

  it("drops stale notification side effects after the active user changes", async () => {
    const deferredSnapshot = createDeferred<{
      budgets: any[];
      budgetProgress: any[];
      summary: { totalBudget: number; totalSpent: number; percentUsed: number };
      autoSuggestions: any[];
      pendingAlerts: any[];
      pendingPermissionRequest: boolean;
    }>();

    mockRefreshMonth.mockReturnValueOnce(deferredSnapshot.promise);

    const store = await getStore();
    store.getState().initStore(mockDb, USER_ID);
    store.setState({ currentMonth: "2026-03" as Month });

    const load = store.getState().loadBudgets();
    const initialMonitoringPorts = mockCreateBudgetMonitoringModule.mock.calls[0]?.[0];

    expect(initialMonitoringPorts).toBeDefined();

    store.getState().initStore(mockDb, "user-2" as UserId);

    initialMonitoringPorts.insertNotification({
      type: "budget_alert",
      dedupKey: "budget_alert:food:80:2026-03",
      categoryId: "food" as CategoryId,
      goalId: null,
      titleKey: "notifications.budgetWarning",
      messageKey: "notifications.budgetWarningMsg",
      params: null,
    });

    expect(mockInsertNotificationRecord).not.toHaveBeenCalled();

    deferredSnapshot.resolve({
      budgets: [],
      budgetProgress: [],
      summary: { totalBudget: 0, totalSpent: 0, percentUsed: 0 },
      autoSuggestions: [],
      pendingAlerts: [],
      pendingPermissionRequest: false,
    });
    await load;
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
