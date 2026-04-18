import { describe, expect, it, vi } from "vitest";
import { subscribeGoalsToTransactions } from "@/features/goals/services/subscribe-goals-to-transactions";

describe("goal transaction subscription", () => {
  it("reloads only after goals have loaded and the transaction pages reference changes", () => {
    let notify: () => void = () => undefined;
    let hasLoadedGoals = false;
    let currentPages: readonly string[] = ["tx-1"];

    const unsubscribe = vi.fn();
    const reload = vi.fn();

    const cleanup = subscribeGoalsToTransactions({
      subscribeTransactions: (listener) => {
        notify = listener;
        return unsubscribe;
      },
      getTransactionPages: () => currentPages,
      hasLoadedGoals: () => hasLoadedGoals,
      reload,
    });

    notify();
    expect(reload).not.toHaveBeenCalled();

    hasLoadedGoals = true;
    notify();
    expect(reload).not.toHaveBeenCalled();

    currentPages = ["tx-1", "tx-2"];
    notify();
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
