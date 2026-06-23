import NetInfo from "@react-native-community/netinfo";
import type { BootstrapTask, SubscriptionTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { getSupabase } from "@/shared/db/supabase";
import { captureWarning } from "@/shared/lib";
import {
  beginCloudLedgerRuntimeCacheWrite,
  flushPendingCloudLedgerChanges,
  getCloudLedgerOutbox,
  getCloudLedgerRuntimeCache,
  isCloudLedgerRuntimeCacheWriteCurrent,
  restoreOptimisticCloudLedgerCache,
  resumeCloudLedgerRuntimeCacheWrites,
  setCloudLedgerRuntimeCacheIfCurrent,
} from "./public";

export const cloudLedgerBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "cloud-ledger",
  run: async ({ enableRemoteEffects, userId }) => {
    await restoreCloudLedgerOptimisticState(userId);
    if (!enableRemoteEffects) {
      return;
    }
    await flushCloudLedgerOutboxForUser(userId).catch(captureCloudLedgerOutboxFlushFailure);
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
  resumeCloudLedgerRuntimeCacheWrites(userId);
  const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
  setCloudLedgerRuntimeCacheIfCurrent(
    userId,
    writeToken,
    await restoreOptimisticCloudLedgerCache({
      cache: getCloudLedgerRuntimeCache(userId),
      outbox: getCloudLedgerOutbox(userId),
    })
  );
}

export async function flushCloudLedgerOutboxForUser(
  userId: AuthenticatedBootstrapContext["userId"]
): Promise<void> {
  const writeToken = beginCloudLedgerRuntimeCacheWrite(userId);
  if (!isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken)) {
    return;
  }
  setCloudLedgerRuntimeCacheIfCurrent(
    userId,
    writeToken,
    await flushPendingCloudLedgerChanges({
      cache: getCloudLedgerRuntimeCache(userId),
      outbox: getCloudLedgerOutbox(userId),
      supabase: getSupabase(),
      shouldContinue: () => isCloudLedgerRuntimeCacheWriteCurrent(userId, writeToken),
    })
  );
}

function captureCloudLedgerOutboxFlushFailure(error: unknown): void {
  captureWarning("cloud_ledger_outbox_flush_failed", {
    errorType: error instanceof Error ? error.name : typeof error,
  });
}
