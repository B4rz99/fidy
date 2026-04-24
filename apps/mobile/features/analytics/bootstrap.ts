import type { BootstrapTask, SubscriptionTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { subscribeAnalyticsToTransactions } from "./services/subscribe-analytics-to-transactions";
import { initializeAnalyticsSession, loadAnalyticsForUser, useAnalyticsStore } from "./public";
import { useTransactionStore } from "../transactions/store.public";

export const analyticsBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "analytics",
  run: ({ db, userId }) => {
    initializeAnalyticsSession(userId);
    void loadAnalyticsForUser(db, userId).catch(
      handleRecoverableError("Failed to load analytics")
    );
  },
};

export const analyticsTransactionSubscriptionTask: SubscriptionTask<AuthenticatedBootstrapContext> =
  {
    id: "analytics-transaction-subscription",
    subscribe: ({ db, userId }) =>
      subscribeAnalyticsToTransactions({
        subscribeTransactions: useTransactionStore.subscribe,
        getTransactionDataRevision: () => useTransactionStore.getState().dataRevision,
        hasLoadedAnalytics: () => useAnalyticsStore.getState().incomeExpense !== null,
        reload: () => {
          void loadAnalyticsForUser(db, userId).catch(
            handleRecoverableError("Failed to load analytics")
          );
        },
      }),
  };
