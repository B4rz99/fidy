import { describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { createBudgetStoreState } from "@/features/budget/store/state";
import { requireUserId } from "@/shared/types/assertions";
import type { BudgetId, Month } from "@/shared/types/branded";

const INITIAL_MONTH = "2026-03" as Month;
const ACKNOWLEDGED_ALERT_KEY = "budget-1:80";
const BUDGET_ID = "budget-1" as BudgetId;

function createStore(acknowledgeAlert = vi.fn<(...args: any[]) => any>()) {
  return create(createBudgetStoreState(INITIAL_MONTH, { acknowledgeAlert }));
}

function applySnapshot(store: ReturnType<typeof createStore>) {
  store.getState().setSnapshot({
    budgets: [{ id: "budget-1", categoryId: "food", month: INITIAL_MONTH }] as never[],
    budgetProgress: [] as never[],
    summary: { totalBudget: 100000, totalSpent: 25000, percentUsed: 25 },
    autoSuggestions: [] as never[],
    pendingAlerts: [
      {
        budgetId: BUDGET_ID,
        categoryId: "food" as never,
        threshold: 80,
        percentUsed: 80,
        suggestionKey: "guidance.budgetAlert80.food",
        remainingAmount: 20000 as never,
        daysLeft: 5,
      },
    ],
    pendingPermissionRequest: true,
  });
}

describe("budget store state helper", () => {
  it("begins a new session while preserving the active month baseline", () => {
    const store = createStore();

    store.getState().setMonth("2026-04" as Month);
    store.getState().setIsLoading(true);
    store.getState().beginSession(requireUserId("user-1"));

    expect(store.getState()).toMatchObject({
      activeUserId: requireUserId("user-1"),
      currentMonth: "2026-04",
      budgets: [],
      hasLoadedOnce: false,
      isLoading: false,
    });
  });

  it("applies snapshots and clears pending permission requests", () => {
    const store = createStore();

    applySnapshot(store);
    store.getState().clearPendingPermissionRequest();

    expect(store.getState()).toMatchObject({
      hasLoadedOnce: true,
      pendingPermissionRequest: false,
      summary: { totalBudget: 100000, totalSpent: 25000, percentUsed: 25 },
      pendingAlerts: expect.arrayContaining([expect.objectContaining({ budgetId: BUDGET_ID })]),
    });
  });

  it("delegates alert acknowledgement through the manager", () => {
    const acknowledgeAlert = vi.fn<(...args: any[]) => any>().mockReturnValue({
      acknowledgedAlerts: new Set([ACKNOWLEDGED_ALERT_KEY]),
      pendingAlerts: [],
    });
    const store = createStore(acknowledgeAlert);

    applySnapshot(store);
    store.getState().acknowledgeAlert(BUDGET_ID, 80);

    expect(acknowledgeAlert).toHaveBeenCalledWith({
      budgetId: BUDGET_ID,
      threshold: 80,
      alertState: {
        pendingAlerts: expect.arrayContaining([expect.objectContaining({ budgetId: BUDGET_ID })]),
        acknowledgedAlerts: new Set(),
      },
    });
    expect(Array.from(store.getState().acknowledgedAlerts)).toEqual([ACKNOWLEDGED_ALERT_KEY]);
    expect(store.getState().pendingAlerts).toEqual([]);
  });
});
