// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBudgetMonitoringModule } from "@/features/budget/lib/monitoring";
import { insertBudget } from "@/features/budget/lib/repository";
import { insertTransaction } from "@/features/transactions/lib/repository";
import type {
  BudgetId,
  CategoryId,
  CopAmount,
  IsoDateTime,
  Month,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const CURRENT_MONTH = "2026-03" as Month;

const mockScheduleBudgetAlert = vi.fn();
const mockInsertNotification = vi.fn();
const mockResolveCategoryLabel = vi.fn(
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
  insertBudget(db as any, {
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
  insertTransaction(db as any, {
    id: (overrides.id ?? "tx-1") as any,
    userId: USER_ID,
    type: "expense",
    amount: (overrides.amount ?? 85000) as CopAmount,
    categoryId: (overrides.categoryId ?? "food") as CategoryId,
    description: "merchant",
    date: (overrides.date ?? `${overrides.month ?? CURRENT_MONTH}-10`) as any,
    createdAt: "2026-03-10T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-10T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    source: "manual",
  });

describe("createBudgetMonitoringModule", () => {
  it("refreshMonth loads budgets, derives alerts, and delivers fresh ones", async () => {
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
      month: "2026-02" as Month,
    });

    const module = createBudgetMonitoringModule({
      getBudgetAlertsEnabled: () => true,
      getLocale: () => "es",
      resolveCategoryLabel: mockResolveCategoryLabel,
      scheduleBudgetAlert: mockScheduleBudgetAlert,
      insertNotification: mockInsertNotification,
    });

    const result = await module.refreshMonth({
      db: db as any,
      userId: USER_ID,
      month: CURRENT_MONTH,
      previous: {
        pendingAlerts: [],
        acknowledgedAlerts: new Set(),
      },
    });

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
  });

  it("refreshMonth skips duplicate delivery when the same alert is still pending", async () => {
    insertBudgetRow();
    insertExpense({
      id: "tx-1",
      categoryId: "food" as CategoryId,
      amount: 85000 as CopAmount,
    });

    const module = createBudgetMonitoringModule({
      getBudgetAlertsEnabled: () => true,
      getLocale: () => "es",
      resolveCategoryLabel: mockResolveCategoryLabel,
      scheduleBudgetAlert: mockScheduleBudgetAlert,
      insertNotification: mockInsertNotification,
    });

    const first = await module.refreshMonth({
      db: db as any,
      userId: USER_ID,
      month: CURRENT_MONTH,
      previous: {
        pendingAlerts: [],
        acknowledgedAlerts: new Set(),
      },
    });

    expect(first.pendingAlerts).toHaveLength(1);
    expect(mockScheduleBudgetAlert).toHaveBeenCalledOnce();
    expect(mockInsertNotification).toHaveBeenCalledOnce();

    mockScheduleBudgetAlert.mockClear();
    mockInsertNotification.mockClear();
    mockResolveCategoryLabel.mockClear();

    const second = await module.refreshMonth({
      db: db as any,
      userId: USER_ID,
      month: CURRENT_MONTH,
      previous: {
        pendingAlerts: first.pendingAlerts,
        acknowledgedAlerts: new Set(),
      },
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

    const module = createBudgetMonitoringModule({
      getBudgetAlertsEnabled: () => true,
      getLocale: () => "es",
      resolveCategoryLabel: mockResolveCategoryLabel,
      scheduleBudgetAlert: mockScheduleBudgetAlert,
      insertNotification: mockInsertNotification,
    });

    const result = await module.refreshMonth({
      db: db as any,
      userId: USER_ID,
      month: CURRENT_MONTH,
      previous: {
        pendingAlerts: [],
        acknowledgedAlerts: new Set(),
      },
    });

    expect(result.pendingPermissionRequest).toBe(true);
    expect(mockScheduleBudgetAlert).toHaveBeenCalledOnce();
    expect(mockInsertNotification).toHaveBeenCalledOnce();
  });

  it("acknowledgeAlert removes the targeted alert from pending state", () => {
    const module = createBudgetMonitoringModule({
      getBudgetAlertsEnabled: () => true,
      getLocale: () => "es",
      resolveCategoryLabel: mockResolveCategoryLabel,
      scheduleBudgetAlert: mockScheduleBudgetAlert,
      insertNotification: mockInsertNotification,
    });

    const nextState = module.acknowledgeAlert({
      budgetId: "budget-1" as BudgetId,
      threshold: 80,
      alertState: {
        pendingAlerts: [
          {
            budgetId: "budget-1" as BudgetId,
            categoryId: "food" as CategoryId,
            threshold: 80,
            percentUsed: 85,
            suggestionKey: undefined,
            daysLeft: 10,
            remainingAmount: 15000 as CopAmount,
          },
          {
            budgetId: "budget-2" as BudgetId,
            categoryId: "transport" as CategoryId,
            threshold: 80,
            percentUsed: 90,
            suggestionKey: undefined,
            daysLeft: 10,
            remainingAmount: 10000 as CopAmount,
          },
        ],
        acknowledgedAlerts: new Set(["budget-2:80"]),
      },
    });

    expect(nextState.pendingAlerts).toHaveLength(1);
    expect(nextState.pendingAlerts[0]?.budgetId).toBe("budget-2");
    expect(nextState.acknowledgedAlerts.has("budget-1:80")).toBe(true);
    expect(nextState.acknowledgedAlerts.has("budget-2:80")).toBe(true);
  });
});
