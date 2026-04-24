import { tryEnsureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { initializeTransactionSession, loadInitialTransactions, useTransactionStore } from "./store.public";

export const transactionBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "transactions",
  run: ({ db, userId }) => {
    initializeTransactionSession(userId);
    const defaultAccount = tryEnsureDefaultFinancialAccount(db, userId);
    if (defaultAccount) {
      useTransactionStore.getState().setDefaultAccountId(defaultAccount.id);
    }
    void loadInitialTransactions(db, userId).catch(
      handleRecoverableError("Failed to load transactions")
    );
  },
};
