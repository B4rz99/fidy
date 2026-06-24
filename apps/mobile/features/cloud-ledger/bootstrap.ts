import NetInfo from "@react-native-community/netinfo";
import type { BootstrapTask, SubscriptionTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { captureWarning } from "@/shared/lib";
import {
  flushCloudLedgerOutboxForUser,
  restoreCloudLedgerOptimisticRuntimeState,
} from "./runtime-mutations";

export { flushCloudLedgerOutboxForUser };

export const cloudLedgerBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "cloud-ledger",
  run: async ({ enableRemoteEffects, userId }) => {
    await restoreCloudLedgerOptimisticState(userId);
    if (!enableRemoteEffects) {
      return;
    }
    void flushCloudLedgerOutboxForUser(userId).catch(captureCloudLedgerOutboxFlushFailure);
  },
};

export const cloudLedgerReconnectFlushTask: SubscriptionTask<AuthenticatedBootstrapContext> = {
  id: "cloud-ledger-reconnect-flush",
  isEnabled: ({ enableRemoteEffects }) => enableRemoteEffects,
  subscribe: ({ userId }) =>
    NetInfo.addEventListener((state) => {
      if (state.isConnected !== true) {
        return;
      }
      void flushCloudLedgerOutboxForUser(userId).catch(captureCloudLedgerOutboxFlushFailure);
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
