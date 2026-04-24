import type { BootstrapTask, SubscriptionTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { subscribeBudgetToTransactions } from "./services/subscribe-budget-to-transactions";
import { initializeBudgetSession, loadBudgetsForUser, useBudgetStore } from "./public";
import { useTransactionStore } from "../transactions/store.public";

export const budgetBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "budget",
  run: ({ db, userId }) => {
    initializeBudgetSession(userId);
    void loadBudgetsForUser(db, userId).catch(handleRecoverableError("Failed to load budgets"));
  },
};

export const budgetTransactionSubscriptionTask: SubscriptionTask<AuthenticatedBootstrapContext> = {
  id: "budget-transaction-subscription",
  subscribe: ({ db, userId }) =>
    subscribeBudgetToTransactions({
      subscribeTransactions: useTransactionStore.subscribe,
      getTransactionDataRevision: () => useTransactionStore.getState().dataRevision,
      hasLoadedBudgetState: () => useBudgetStore.getState().hasLoadedOnce,
      reload: () => {
        void loadBudgetsForUser(db, userId).catch(handleRecoverableError("Failed to load budgets"));
      },
    }),
};
