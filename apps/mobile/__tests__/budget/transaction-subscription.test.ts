import { describe, expect, it, vi } from "vitest";
import { subscribeBudgetToTransactions } from "@/features/budget/services/subscribe-budget-to-transactions";

describe("budget transaction subscription", () => {
  it("reloads only after budget state has loaded and the transaction data revision changes", () => {
    let notify: () => void = () => undefined;
    let hasLoadedBudgetState = false;
    let currentRevision = 0;

    const unsubscribe = vi.fn();
    const reload = vi.fn();

    const cleanup = subscribeBudgetToTransactions({
      subscribeTransactions: (listener) => {
        notify = listener;
        return unsubscribe;
      },
      getTransactionDataRevision: () => currentRevision,
      hasLoadedBudgetState: () => hasLoadedBudgetState,
      reload,
    });

    notify();
    expect(reload).not.toHaveBeenCalled();

    hasLoadedBudgetState = true;
    notify();
    expect(reload).not.toHaveBeenCalled();

    currentRevision += 1;
    notify();
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
