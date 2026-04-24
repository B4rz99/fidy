import type { BootstrapTask, SubscriptionTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { subscribeGoalsToTransactions } from "./services/subscribe-goals-to-transactions";
import { initializeGoalSession, loadGoalsForUser, useGoalStore } from "./public";
import { useTransactionStore } from "../transactions/store.public";

export const goalsBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "goals",
  run: ({ db, userId }) => {
    initializeGoalSession(userId);
    void loadGoalsForUser(db, userId).catch(handleRecoverableError("Failed to load goals"));
  },
};

export const goalsTransactionSubscriptionTask: SubscriptionTask<AuthenticatedBootstrapContext> = {
  id: "goals-transaction-subscription",
  subscribe: ({ db, userId }) =>
    subscribeGoalsToTransactions({
      subscribeTransactions: useTransactionStore.subscribe,
      getTransactionDataRevision: () => useTransactionStore.getState().dataRevision,
      hasLoadedGoals: () => useGoalStore.getState().goals.length > 0,
      reload: () => {
        void loadGoalsForUser(db, userId).catch(handleRecoverableError("Failed to load goals"));
      },
    }),
};
