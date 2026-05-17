import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetAlertState, BudgetMonitoringPorts } from "@/features/budget/lib/monitoring";
import { createBudgetMonitoringModule } from "@/features/budget/lib/monitoring";
import { insertBudget } from "@/features/budget/lib/repository";
import { insertTransactionStorageRow as insertTransaction } from "@/infrastructure/local-ledger/transaction-storage";
import type { AnyDb } from "@/shared/db";
import type {
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  Month,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const testDb = () => db as unknown as AnyDb;

const USER_ID = "user-1" as UserId;
const CURRENT_MONTH = "2026-03" as Month;
const CURRENT_DATE = new Date(2026, 3, 18);

const mockScheduleBudgetAlert = vi.fn<BudgetMonitoringPorts["scheduleBudgetAlert"]>();
const mockInsertNotification = vi.fn<(...args: unknown[]) => unknown>();
const mockResolveCategoryLabel = vi.fn<(categoryId: CategoryId, locale: string) => string>(
  (categoryId: CategoryId, locale: string) => `${locale}:${categoryId}`
);

beforeEach(() => {
  vi.clearAllMocks();

  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });

  mockScheduleBudgetAlert.mockResolvedValue({ type: "scheduled", id: "notif-1" });
});

afterEach(() => {
  sqlite.close();
});

const insertBudgetRow = (
  overrides: Partial<{
    id: BudgetId;
    categoryId: CategoryId;
    amount: CopAmount;
    month: Month;
  }> = {}
) =>
  insertBudget(testDb(), {
    id: (overrides.id ?? "budget-1") as BudgetId,
    userId: USER_ID,
    categoryId: (overrides.categoryId ?? "food") as CategoryId,
    amount: (overrides.amount ?? 100000) as CopAmount,
    month: (overrides.month ?? CURRENT_MONTH) as Month,
    createdAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-01T00:00:00.000Z" as IsoDateTime,
    deletedAt: null,
  });

const insertExpense = (
  overrides: Partial<{
    id: string;
    categoryId: CategoryId;
    amount: CopAmount;
    date: string;
    month: Month;
  }> = {}
) =>
  insertTransaction(testDb(), {
    id: (overrides.id ?? "tx-1") as TransactionId,
    userId: USER_ID,
    type: "expense",
    amount: (overrides.amount ?? 85000) as CopAmount,
    categoryId: (overrides.categoryId ?? "food") as CategoryId,
    description: "merchant",
    date: (overrides.date ?? `${overrides.month ?? CURRENT_MONTH}-10`) as IsoDate,
    createdAt: "2026-03-10T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-10T10:00:00.000Z" as IsoDateTime,
    voidedAt: null,
    source: "manual",
  });

function createMonitoringModule() {
  return createBudgetMonitoringModule({
    getBudgetAlertsEnabled: () => true,
    getLocale: () => "es",
    getCurrentDate: () => CURRENT_DATE,
    resolveCategoryLabel: mockResolveCategoryLabel,
    scheduleBudgetAlert: mockScheduleBudgetAlert,
    insertNotification: mockInsertNotification,
  });
}

async function refreshCurrentMonth(
  module = createMonitoringModule(),
  previous: BudgetAlertState | undefined = {
    pendingAlerts: [],
    acknowledgedAlerts: new Set(),
  }
) {
  return module.refreshMonth({
    db: testDb(),
    userId: USER_ID,
    month: CURRENT_MONTH,
    ...(previous ? { previous } : {}),
  });
}

function createPendingAlertState(): BudgetAlertState {
  return {
    pendingAlerts: [
      {
        budgetId: "budget-1" as BudgetId,
        categoryId: "food" as CategoryId,
        threshold: 80 as const,
        percentUsed: 85,
        suggestionKey: undefined,
        daysLeft: 10,
        remainingAmount: 15000 as CopAmount,
      },
      {
        budgetId: "budget-2" as BudgetId,
        categoryId: "transport" as CategoryId,
        threshold: 80 as const,
        percentUsed: 90,
        suggestionKey: undefined,
        daysLeft: 10,
        remainingAmount: 10000 as CopAmount,
      },
    ],
    acknowledgedAlerts: new Set(["budget-2:80"]),
  };
}

function seedBudgetAlertScenario() {
  insertBudgetRow();
  insertBudgetRow({
    id: "budget-2" as BudgetId,
    categoryId: "transport" as CategoryId,
    amount: 50000 as CopAmount,
  });
  insertExpense({ id: "tx-1", categoryId: "food" as CategoryId, amount: 85000 as CopAmount });
  insertExpense({
    id: "tx-2",
    categoryId: "transport" as CategoryId,
    amount: 10000 as CopAmount,
  });
  insertExpense({
    id: "tx-3",
    categoryId: "entertainment" as CategoryId,
    amount: 43234 as CopAmount,
    date: "2026-02-12",
  });
}

function expectDeliveredBudgetAlert(result: Awaited<ReturnType<typeof refreshCurrentMonth>>) {
  expect(result.budgets).toHaveLength(2);
  expect(result.budgetProgress).toHaveLength(2);
  expect(result.summary).toEqual({
    totalBudget: 150000,
    totalSpent: 95000,
    percentUsed: 63,
  });
  expect(result.autoSuggestions).toEqual([
    { categoryId: "entertainment" as CategoryId, suggestedAmount: 44000 as CopAmount },
  ]);
  expect(result.pendingAlerts).toHaveLength(1);
  expect(result.pendingAlerts[0]?.budgetId).toBe("budget-1");
  expect(result.pendingPermissionRequest).toBe(false);
  expect(mockResolveCategoryLabel).toHaveBeenCalledWith("food", "es");
  expect(mockScheduleBudgetAlert).toHaveBeenCalledOnce();
  expect(mockInsertNotification).toHaveBeenCalledOnce();
  const inserted = mockInsertNotification.mock.calls[0]?.[0] as { params: string };
  expect(JSON.parse(inserted.params)).toMatchObject({
    category: "es:food",
    threshold: 80,
    daysLeft: expect.any(Number),
  });
}

function seedInitialOverBudgetScenario() {
  insertBudgetRow({
    id: "budget-1" as BudgetId,
    categoryId: "food" as CategoryId,
    amount: 100000 as CopAmount,
  });
  insertBudgetRow({
    id: "budget-2" as BudgetId,
    categoryId: "transport" as CategoryId,
    amount: 50000 as CopAmount,
  });
  insertExpense({
    id: "tx-1",
    categoryId: "food" as CategoryId,
    amount: 110000 as CopAmount,
  });
}

function expectInitialOverBudgetProgress(result: Awaited<ReturnType<typeof refreshCurrentMonth>>) {
  expect(result.budgetProgress).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        budgetId: "budget-1",
        spent: 110000,
        remaining: -10000,
        percentUsed: 110,
      }),
      expect.objectContaining({
        budgetId: "budget-2",
        spent: 0,
        remaining: 50000,
        percentUsed: 0,
      }),
    ])
  );
}

function expectInitialOverBudgetDelivery(result: Awaited<ReturnType<typeof refreshCurrentMonth>>) {
  expect(result.pendingPermissionRequest).toBe(false);
  expect(result.pendingAlerts).toEqual([
    expect.objectContaining({
      budgetId: "budget-1",
      threshold: 100,
    }),
  ]);
  expect(mockScheduleBudgetAlert).toHaveBeenCalledWith(
    expect.objectContaining({ budgetId: "budget-1", threshold: 100 }),
    "es:food",
    true
  );
  expect(mockInsertNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      titleKey: "notifications.budgetExceeded",
      messageKey: "notifications.budgetExceededMsg",
      dedupKey: "budget_alert:food:100:2026-03",
    })
  );
}

describe("createBudgetMonitoringModule", () => {
  it("refreshMonth loads budgets, derives alerts, and delivers fresh ones", async () => {
    seedBudgetAlertScenario();
    const result = await refreshCurrentMonth();
    expectDeliveredBudgetAlert(result);
  });

  it("refreshMonth skips duplicate delivery when the same alert is still pending", async () => {
    insertBudgetRow();
    insertExpense({
      id: "tx-1",
      categoryId: "food" as CategoryId,
      amount: 85000 as CopAmount,
    });

    const module = createMonitoringModule();
    const first = await refreshCurrentMonth(module);

    expect(first.pendingAlerts).toHaveLength(1);
    expect(mockScheduleBudgetAlert).toHaveBeenCalledOnce();
    expect(mockInsertNotification).toHaveBeenCalledOnce();

    mockScheduleBudgetAlert.mockClear();
    mockInsertNotification.mockClear();
    mockResolveCategoryLabel.mockClear();

    const second = await refreshCurrentMonth(module, {
      pendingAlerts: first.pendingAlerts,
      acknowledgedAlerts: new Set(),
    });

    expect(second.pendingAlerts).toHaveLength(1);
    expect(mockScheduleBudgetAlert).not.toHaveBeenCalled();
    expect(mockInsertNotification).not.toHaveBeenCalled();
    expect(mockResolveCategoryLabel).not.toHaveBeenCalled();
  });

  it("refreshMonth requests permission when delivery needs it", async () => {
    insertBudgetRow();
    insertExpense({
      id: "tx-1",
      categoryId: "food" as CategoryId,
      amount: 85000 as CopAmount,
    });

    mockScheduleBudgetAlert.mockResolvedValueOnce({ type: "needs_permission" });

    const result = await refreshCurrentMonth();

    expect(result.pendingPermissionRequest).toBe(true);
    expect(mockScheduleBudgetAlert).toHaveBeenCalledOnce();
    expect(mockInsertNotification).toHaveBeenCalledOnce();
  });

  it("refreshMonth keeps succeeding when a later fresh alert delivery throws", async () => {
    insertBudgetRow({
      id: "budget-1" as BudgetId,
      categoryId: "food" as CategoryId,
      amount: 100000 as CopAmount,
    });
    insertBudgetRow({
      id: "budget-2" as BudgetId,
      categoryId: "transport" as CategoryId,
      amount: 100000 as CopAmount,
    });

    insertExpense({
      id: "tx-1",
      categoryId: "food" as CategoryId,
      amount: 85000 as CopAmount,
    });
    insertExpense({
      id: "tx-2",
      categoryId: "transport" as CategoryId,
      amount: 90000 as CopAmount,
    });

    mockScheduleBudgetAlert
      .mockResolvedValueOnce({ type: "scheduled", id: "notif-1" })
      .mockRejectedValueOnce(new Error("push service down"));

    const result = await refreshCurrentMonth();

    expect(result.pendingPermissionRequest).toBe(false);
    expect(result.pendingAlerts).toHaveLength(2);
    expect(mockScheduleBudgetAlert).toHaveBeenCalledTimes(2);
    expect(mockInsertNotification).toHaveBeenCalledTimes(2);
  });

  it("refreshMonth derives initial over-budget alerts without previous state", async () => {
    seedInitialOverBudgetScenario();
    const result = await refreshCurrentMonth(undefined, undefined);
    expectInitialOverBudgetProgress(result);
    expectInitialOverBudgetDelivery(result);
  });

  it("loads transaction aggregates from the transactions query public surface", async () => {
    vi.resetModules();

    const getSpendingByCategoryAggregateMock = vi.fn<
      () => { categoryId: CategoryId; total: CopAmount }[]
    >(() => [
      {
        categoryId: "food" as CategoryId,
        total: 85000 as CopAmount,
      },
    ]);

    vi.doMock("@/features/transactions/query.public", () => ({
      getSpendingByCategoryAggregate: getSpendingByCategoryAggregateMock,
      getSpendingByCategoryDateRangeAggregate: vi.fn<() => unknown[]>(() => []),
    }));
    vi.doMock("@/features/transactions/lib/repository", () => ({
      getSpendingByCategoryAggregate: () => {
        throw new Error("budget monitoring should not import transaction internals");
      },
      getSpendingByCategoryDateRangeAggregate: () => {
        throw new Error("budget monitoring should not import transaction internals");
      },
    }));

    const { createBudgetMonitoringModule: createBudgetMonitoringModuleFromPublic } =
      await import("@/features/budget/lib/monitoring");

    insertBudgetRow();

    const module = createBudgetMonitoringModuleFromPublic({
      getBudgetAlertsEnabled: () => true,
      getLocale: () => "es",
      resolveCategoryLabel: mockResolveCategoryLabel,
      scheduleBudgetAlert: mockScheduleBudgetAlert,
      insertNotification: mockInsertNotification,
    });

    const result = await module.refreshMonth({
      db: testDb(),
      userId: USER_ID,
      month: CURRENT_MONTH,
      previous: {
        pendingAlerts: [],
        acknowledgedAlerts: new Set(),
      },
    });

    expect(getSpendingByCategoryAggregateMock).toHaveBeenCalledWith(db, USER_ID, CURRENT_MONTH);
    expect(result.summary).toEqual({
      totalBudget: 100000,
      totalSpent: 85000,
      percentUsed: 85,
    });

    vi.doUnmock("@/features/transactions/query.public");
    vi.doUnmock("@/features/transactions/lib/repository");
    vi.resetModules();
  });

  it("loadAutoSuggestions derives suggestions without delivering alerts", () => {
    insertBudgetRow();
    insertExpense({
      id: "tx-3",
      categoryId: "entertainment" as CategoryId,
      amount: 43234 as CopAmount,
      date: "2026-02-12",
    });

    const suggestions = createMonitoringModule().loadAutoSuggestions({
      db: testDb(),
      userId: USER_ID,
      month: CURRENT_MONTH,
      existingCategoryIds: new Set(["food" as CategoryId]),
    });

    expect(suggestions).toEqual([
      { categoryId: "entertainment" as CategoryId, suggestedAmount: 44000 as CopAmount },
    ]);
    expect(mockScheduleBudgetAlert).not.toHaveBeenCalled();
    expect(mockInsertNotification).not.toHaveBeenCalled();
  });

  it("loadAutoSuggestions uses previous calendar month spending", () => {
    insertBudgetRow();
    insertExpense({
      id: "tx-current-month",
      categoryId: "entertainment" as CategoryId,
      amount: 10000 as CopAmount,
      date: "2026-03-10",
    });
    insertExpense({
      id: "tx-previous-month",
      categoryId: "entertainment" as CategoryId,
      amount: 20000 as CopAmount,
      date: "2026-02-20",
    });

    const suggestions = createMonitoringModule().loadAutoSuggestions({
      db: testDb(),
      userId: USER_ID,
      month: CURRENT_MONTH,
      existingCategoryIds: new Set(["food" as CategoryId]),
    });

    expect(suggestions).toEqual([
      { categoryId: "entertainment" as CategoryId, suggestedAmount: 20000 as CopAmount },
    ]);
  });

  it("acknowledgeAlert removes the targeted alert from pending state", () => {
    const nextState = createMonitoringModule().acknowledgeAlert({
      budgetId: "budget-1" as BudgetId,
      threshold: 80,
      alertState: createPendingAlertState(),
    });

    expect(nextState.pendingAlerts).toHaveLength(1);
    expect(nextState.pendingAlerts[0]?.budgetId).toBe("budget-2");
    expect(nextState.acknowledgedAlerts.has("budget-1:80")).toBe(true);
    expect(nextState.acknowledgedAlerts.has("budget-2:80")).toBe(true);
  });
});
