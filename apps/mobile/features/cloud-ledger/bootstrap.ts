import NetInfo from "@react-native-community/netinfo";
import type { BootstrapTask, SubscriptionTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import {
  persistCloudLedgerRuntimeTransactionShadows,
  refreshTransactions,
} from "@/features/transactions/store.public";
import { captureWarning } from "@/shared/lib";
import {
  flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticRuntimeState,
} from "./runtime-mutations";

export { flushCloudLedgerOutboxForUser };

function isBootstrapContextCurrent(context: AuthenticatedBootstrapContext): boolean {
  return context.isCurrent?.() ?? true;
}

export const cloudLedgerBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "cloud-ledger",
  run: async (context) => {
    const { db, enableRemoteEffects, userId } = context;
    await restoreCloudLedgerOptimisticState(userId).catch(captureCloudLedgerOutboxRestoreFailure);
    if (!isBootstrapContextCurrent(context)) {
      return;
    }
    if (!enableRemoteEffects) {
      return;
    }
    void flushCloudLedgerOutboxForUser(userId)
      .then((didWriteRuntimeCache) => {
        if (!didWriteRuntimeCache) return;
        if (!isBootstrapContextCurrent(context)) return;
        persistCloudLedgerRuntimeTransactionShadows(db, userId);
        if (!isBootstrapContextCurrent(context)) return;
        return refreshTransactions(db, userId);
      })
      .catch(captureCloudLedgerOutboxFlushFailure);
  },
};

export const cloudLedgerReconnectFlushTask: SubscriptionTask<AuthenticatedBootstrapContext> = {
  id: "cloud-ledger-reconnect-flush",
  isEnabled: ({ enableRemoteEffects }) => enableRemoteEffects,
  subscribe: (context) =>
    NetInfo.addEventListener((state) => {
      if (state.isConnected !== true) {
        return;
      }
      if (!isBootstrapContextCurrent(context)) {
        return;
      }
      const { db, userId } = context;
      void flushCloudLedgerOutboxForUser(userId)
        .then((didWriteRuntimeCache) => {
          if (!didWriteRuntimeCache) return;
          if (!isBootstrapContextCurrent(context)) return;
          persistCloudLedgerRuntimeTransactionShadows(db, userId);
          if (!isBootstrapContextCurrent(context)) return;
          return refreshTransactions(db, userId);
        })
        .catch(captureCloudLedgerOutboxFlushFailure);
    }),
};

export async function restoreCloudLedgerOptimisticState(
  userId: AuthenticatedBootstrapContext["userId"]
): Promise<void> {
  await restoreCloudLedgerOptimisticRuntimeState(userId);
}

function captureCloudLedgerOutboxFlushFailure(error: unknown): void {
  captureWarning("cloud_ledger_outbox_flush_failed", {
    errorType: error instanceof Error ? error.name : typeof error,
  });
}

function captureCloudLedgerOutboxRestoreFailure(error: unknown): void {
  captureWarning("cloud_ledger_outbox_restore_failed", {
    errorType: error instanceof Error ? error.name : typeof error,
  });
}
