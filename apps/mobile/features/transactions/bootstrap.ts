import { tryEnsureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { captureWarning } from "@/shared/lib";
import {
  initializeTransactionSession,
  loadInitialTransactions,
  useTransactionStore,
} from "./store.public";

const getErrorType = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

export const transactionBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "transactions",
  run: ({ db, enableRemoteEffects, userId }) => {
    initializeTransactionSession(userId, { enableRemoteEffects });
    const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
    if (defaultAccount) {
      useTransactionStore.getState().setDefaultAccountId(defaultAccount.id);
    }
    void loadInitialTransactions(db, userId).catch((error) => {
      captureWarning("transactions_initial_load_failed", {
        errorType: getErrorType(error),
      });
    });
  },
};
