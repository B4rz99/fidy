import { describe, expect, it, vi } from "vitest";
import { subscribeGoalsToTransactions } from "@/features/goals/services/subscribe-goals-to-transactions";

describe("goal transaction subscription", () => {
  it("reloads only after goals have loaded and the transaction data revision changes", () => {
    let notify: () => void = () => undefined;
    let hasLoadedGoals = false;
    let currentRevision = 0;

    const unsubscribe = vi.fn();
    const reload = vi.fn();

    const cleanup = subscribeGoalsToTransactions({
      subscribeTransactions: (listener) => {
        notify = listener;
        return unsubscribe;
      },
      getTransactionDataRevision: () => currentRevision,
      hasLoadedGoals: () => hasLoadedGoals,
      reload,
    });

    notify();
    expect(reload).not.toHaveBeenCalled();

    hasLoadedGoals = true;
    notify();
    expect(reload).not.toHaveBeenCalled();

    currentRevision += 1;
    notify();
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
