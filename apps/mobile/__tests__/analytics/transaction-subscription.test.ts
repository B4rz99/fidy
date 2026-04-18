import { describe, expect, it, vi } from "vitest";
import { subscribeAnalyticsToTransactions } from "@/features/analytics/services/subscribe-analytics-to-transactions";

describe("analytics transaction subscription", () => {
  it("reloads only after analytics has loaded and the transaction data revision changes", () => {
    let notify: () => void = () => undefined;
    let hasLoadedAnalytics = false;
    let currentRevision = 0;

    const unsubscribe = vi.fn();
    const reload = vi.fn();

    const cleanup = subscribeAnalyticsToTransactions({
      subscribeTransactions: (listener) => {
        notify = listener;
        return unsubscribe;
      },
      getTransactionDataRevision: () => currentRevision,
      hasLoadedAnalytics: () => hasLoadedAnalytics,
      reload,
    });

    notify();
    expect(reload).not.toHaveBeenCalled();

    hasLoadedAnalytics = true;
    notify();
    expect(reload).not.toHaveBeenCalled();

    currentRevision += 1;
    notify();
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
