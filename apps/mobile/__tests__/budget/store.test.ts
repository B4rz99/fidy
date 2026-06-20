import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BudgetMonthSnapshot,
  BudgetMonitoringModule,
  BudgetMonitoringPorts,
} from "@/features/budget/lib/monitoring";
import type { Budget } from "@/features/budget/schema";
import type * as TransactionsModule from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { requireCopAmount } from "@/shared/types/assertions";
import type { BudgetId, CategoryId, IsoDateTime, Month, UserId } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const NOW = "2026-03-01T00:00:00.000Z" as IsoDateTime;

const mockCreateBudgetMonitoringModule =
  vi.fn<(ports: BudgetMonitoringPorts) => BudgetMonitoringModule>();
const mockRefreshMonth =
  vi.fn<(input: { readonly month: Month }) => Promise<BudgetMonthSnapshot>>();
const mockLoadAutoSuggestions = vi.fn<BudgetMonitoringModule["loadAutoSuggestions"]>();
const mockAcknowledgeAlert = vi.fn<BudgetMonitoringModule["acknowledgeAlert"]>();
const mockInsertNotificationRecord = vi.fn<(...args: any[]) => any>();
const mockCommit = vi.fn<(...args: any[]) => Promise<{ success: boolean }>>();
const mockCommitBatch = vi.fn<(...args: any[]) => Promise<readonly { success: boolean }[]>>();

vi.mock("@/features/budget/lib/monitoring", () => ({
  createBudgetMonitoringModule: mockCreateBudgetMonitoringModule.mockImplementation(() => ({
    refreshMonth: mockRefreshMonth,
    loadAutoSuggestions: mockLoadAutoSuggestions,
    acknowledgeAlert: mockAcknowledgeAlert,
  })),
}));

vi.mock("@/mutations", () => ({
  createWriteThroughMutationModule: () => ({
    commit: (...args: any[]) => mockCommit(...args),
    commitBatch: (...args: any[]) => mockCommitBatch(...args),
  }),
}));

vi.mock("@/features/notifications", () => ({
  insertNotificationRecord: (...args: unknown[]) => mockInsertNotificationRecord(...args),
}));

vi.mock("@/features/settings/public", () => ({
  useSettingsStore: {
    getState: () => ({
      notificationPreferences: { budgetAlerts: true },
    }),
  },
}));

vi.mock("@/features/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionsModule>();
  return {
    ...actual,
    // biome-ignore lint/style/useNamingConvention: mock matches exported constant name
    CATEGORY_MAP: {},
  };
});

vi.mock("@/shared/i18n", () => ({
  getCategoryLabel: vi.fn<(category: { id?: string }, _locale: string) => string>(
    (category) => category.id ?? "unknown"
  ),
  useLocaleStore: {
    getState: () => ({ locale: "es" }),
  },
}));

vi.mock("@/features/budget/lib/notifications", () => ({
  scheduleBudgetAlert: vi.fn<() => void>(),
}));

const mockDb = {} as AnyDb;

const makeBudget = (id: string, categoryId: CategoryId, month: Month): Budget => ({
  id: id as BudgetId,
  userId: USER_ID,
  categoryId,
  amount: requireCopAmount(100000),
  month,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
});

const EMPTY_BUDGET_REFRESH_SNAPSHOT: BudgetMonthSnapshot = {
  budgets: [makeBudget("budget-1", "food" as CategoryId, "2026-03" as Month)],
  budgetProgress: [],
  summary: { totalBudget: requireCopAmount(0), totalSpent: requireCopAmount(0), percentUsed: 0 },
  autoSuggestions: [],
  pendingAlerts: [],
  pendingPermissionRequest: false,
};

const MARCH_STALE_SNAPSHOT: BudgetMonthSnapshot = {
  ...EMPTY_BUDGET_REFRESH_SNAPSHOT,
  budgets: [makeBudget("budget-march", "food" as CategoryId, "2026-03" as Month)],
  summary: {
    totalBudget: requireCopAmount(100000),
    totalSpent: requireCopAmount(85000),
    percentUsed: 85,
  },
};

const APRIL_FRESH_SNAPSHOT: BudgetMonthSnapshot = {
  ...EMPTY_BUDGET_REFRESH_SNAPSHOT,
  budgets: [makeBudget("budget-april", "transport" as CategoryId, "2026-04" as Month)],
  summary: {
    totalBudget: requireCopAmount(120000),
    totalSpent: requireCopAmount(10000),
    percentUsed: 8,
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function getBudgetModule() {
  return import("@/features/budget/store");
}

async function initializeBudgetStore(month: Month = "2026-03" as Month) {
  const module = await getBudgetModule();
  module.initializeBudgetSession(USER_ID);
  module.useBudgetStore.getState().setMonth(month);
  return module;
}

describe("useBudgetStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommit.mockResolvedValue({ success: true });
    mockCommitBatch.mockResolvedValue([{ success: true }]);
    mockRefreshMonth.mockResolvedValue(EMPTY_BUDGET_REFRESH_SNAPSHOT);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("ignores stale budget refresh results after the month changes", async () => {
    const deferredMarch = createDeferred<BudgetMonthSnapshot>();

    mockRefreshMonth.mockImplementation(({ month }: { month: Month }) =>
      month === ("2026-03" as Month) ? deferredMarch.promise : Promise.resolve(APRIL_FRESH_SNAPSHOT)
    );

    const { loadBudgetsForUser, useBudgetStore } = await initializeBudgetStore("2026-03" as Month);
    const staleLoad = loadBudgetsForUser(mockDb, USER_ID);

    useBudgetStore.getState().setMonth("2026-04" as Month);
    const freshLoad = loadBudgetsForUser(mockDb, USER_ID);

    await expect(freshLoad).resolves.toBe(true);
    deferredMarch.resolve(MARCH_STALE_SNAPSHOT);
    await expect(staleLoad).resolves.toBe(false);

    expect(useBudgetStore.getState().currentMonth).toBe("2026-04");
    expect(useBudgetStore.getState().budgets).toEqual(APRIL_FRESH_SNAPSHOT.budgets);
    expect(useBudgetStore.getState().summary).toEqual(APRIL_FRESH_SNAPSHOT.summary);
    expect(useBudgetStore.getState().isLoading).toBe(false);
  });

  it("keeps loaded budget totals addressable by month", async () => {
    mockRefreshMonth.mockResolvedValueOnce(MARCH_STALE_SNAPSHOT);

    const { loadBudgetsForUser, useBudgetStore } = await initializeBudgetStore("2026-03" as Month);

    await expect(loadBudgetsForUser(mockDb, USER_ID)).resolves.toBe(true);

    expect(useBudgetStore.getState().budgetTotalByMonth["2026-03" as Month]).toBe(100000);
  });

  it("clears loading when context changes without starting a newer refresh", async () => {
    const deferredSnapshot = createDeferred<BudgetMonthSnapshot>();
    mockRefreshMonth.mockReturnValueOnce(deferredSnapshot.promise);

    const { initializeBudgetSession, loadBudgetsForUser, useBudgetStore } =
      await initializeBudgetStore("2026-03" as Month);
    const load = loadBudgetsForUser(mockDb, USER_ID);

    initializeBudgetSession("user-2" as UserId);
    deferredSnapshot.resolve(EMPTY_BUDGET_REFRESH_SNAPSHOT);
    await expect(load).resolves.toBe(false);

    expect(useBudgetStore.getState().isLoading).toBe(false);
  });

  it("drops stale notification side effects after the active user changes", async () => {
    const deferredSnapshot = createDeferred<BudgetMonthSnapshot>();
    mockRefreshMonth.mockReturnValueOnce(deferredSnapshot.promise);

    const { initializeBudgetSession, loadBudgetsForUser } = await initializeBudgetStore(
      "2026-03" as Month
    );
    const monitoringCallsBeforeLoad = mockCreateBudgetMonitoringModule.mock.calls.length;
    const load = loadBudgetsForUser(mockDb, USER_ID);
    const initialMonitoringPorts =
      mockCreateBudgetMonitoringModule.mock.calls[monitoringCallsBeforeLoad]?.[0];

    expect(initialMonitoringPorts).toBeDefined();
    if (!initialMonitoringPorts) throw new Error("Expected monitoring ports");

    initializeBudgetSession("user-2" as UserId);
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

    deferredSnapshot.resolve(EMPTY_BUDGET_REFRESH_SNAPSHOT);
    await load;
  });

  it("loads auto suggestions without triggering the full refresh path", async () => {
    const suggestions = [
      {
        categoryId: "entertainment" as CategoryId,
        suggestedAmount: requireCopAmount(44000),
      },
    ];
    mockLoadAutoSuggestions.mockReturnValue(suggestions);

    const { loadBudgetAutoSuggestions, useBudgetStore } = await initializeBudgetStore();
    useBudgetStore.setState({
      currentMonth: "2026-03" as Month,
      budgets: [makeBudget("budget-1", "food" as CategoryId, "2026-03" as Month)],
    });

    loadBudgetAutoSuggestions(mockDb, USER_ID);

    expect(mockLoadAutoSuggestions).toHaveBeenCalledWith({
      db: mockDb,
      userId: USER_ID,
      month: "2026-03",
      existingCategoryIds: new Set(["food" as CategoryId]),
    });
    expect(mockRefreshMonth).not.toHaveBeenCalled();
    expect(useBudgetStore.getState().autoSuggestions).toEqual(suggestions);
  });

  it("creates, updates, and deletes budgets through write-through mutations", async () => {
    const { createBudget, deleteBudget, updateBudget } = await initializeBudgetStore();

    await expect(
      createBudget(mockDb, USER_ID, "food" as CategoryId, requireCopAmount(120000))
    ).resolves.toBe(true);
    await expect(
      updateBudget({
        db: mockDb,
        userId: USER_ID,
        id: "budget-1" as BudgetId,
        categoryId: "transport" as CategoryId,
        amount: requireCopAmount(130000),
      })
    ).resolves.toBe(true);
    await expect(deleteBudget(mockDb, USER_ID, "budget-1" as BudgetId)).resolves.toBe(true);

    expect(mockCommit).toHaveBeenCalledWith(expect.objectContaining({ kind: "budget.save" }));
    expect(mockCommit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "budget.update", categoryId: "transport" })
    );
    expect(mockCommit).toHaveBeenCalledWith(expect.objectContaining({ kind: "budget.delete" }));
  });

  it("returns false when budget creation input is invalid or write-through fails", async () => {
    const { createBudget } = await initializeBudgetStore();

    await expect(
      createBudget(mockDb, USER_ID, "food" as CategoryId, requireCopAmount(0))
    ).resolves.toBe(false);

    mockCommit.mockResolvedValueOnce({ success: false });
    await expect(
      createBudget(mockDb, USER_ID, "food" as CategoryId, requireCopAmount(120000))
    ).resolves.toBe(false);
  });

  it("copies budgets forward and accepts budget suggestions", async () => {
    const { acceptBudgetSuggestions, copyBudgetsForward, useBudgetStore } =
      await initializeBudgetStore("2026-03" as Month);

    await expect(copyBudgetsForward(mockDb, USER_ID, "2026-04" as Month)).resolves.toBe(true);
    await expect(
      acceptBudgetSuggestions(
        mockDb,
        USER_ID,
        new Map([["food" as CategoryId, requireCopAmount(150000)]])
      )
    ).resolves.toBe(true);
    await expect(acceptBudgetSuggestions(mockDb, USER_ID, new Map())).resolves.toBe(true);

    expect(useBudgetStore.getState().currentMonth).toBe("2026-04");
    expect(mockCommit).toHaveBeenCalledWith(expect.objectContaining({ kind: "budget.copy" }));
    expect(mockCommitBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "budget.save",
        row: expect.objectContaining({ categoryId: "food", amount: 150000 }),
      }),
    ]);
  });
});
