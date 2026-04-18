import { describe, expect, it, vi } from "vitest";
import { subscribeAnalyticsToTransactions } from "@/features/analytics/services/subscribe-analytics-to-transactions";

describe("analytics transaction subscription", () => {
  it("reloads only after analytics has loaded and the transaction pages reference changes", () => {
    let notify: () => void = () => undefined;
    let hasLoadedAnalytics = false;
    let currentPages: readonly string[] = ["tx-1"];

    const unsubscribe = vi.fn();
    const reload = vi.fn();

    const cleanup = subscribeAnalyticsToTransactions({
      subscribeTransactions: (listener) => {
        notify = listener;
        return unsubscribe;
      },
      getTransactionPages: () => currentPages,
      hasLoadedAnalytics: () => hasLoadedAnalytics,
      reload,
    });

    notify();
    expect(reload).not.toHaveBeenCalled();

    hasLoadedAnalytics = true;
    notify();
    expect(reload).not.toHaveBeenCalled();

    currentPages = ["tx-1", "tx-2"];
    notify();
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
