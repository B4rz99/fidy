import {
  clearCloudLedgerRuntimeCache,
  resumeCloudLedgerRuntimeCacheWrites,
  suspendCloudLedgerRuntimeCacheWrites,
} from "@/features/cloud-ledger/runtime.public";
import { discardCloudLedgerOutbox } from "@/features/cloud-ledger/outbox.public";
import {
  deleteCloudLedgerTransactionCache,
  invalidateTransactionSession,
  resumeTransactionSession,
} from "@/features/transactions/store.public";
import { resetDbForUser } from "@/shared/db/client";
import { captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";

type DeletedAccountCleanupFailure = {
  readonly error: unknown;
};

function captureCloudLedgerSessionCleanupFailure(event: string, err: unknown) {
  captureWarning(event, {
    errorType: err instanceof Error ? err.message : "unknown",
  });
}

export function suspendCloudLedgerStateForUser(userId: UserId): void {
  invalidateTransactionSession();
  suspendCloudLedgerRuntimeCacheWrites(userId);
}

export function resumeCloudLedgerStateForUser(userId: UserId): void {
  resumeCloudLedgerRuntimeCacheWrites(userId);
  resumeTransactionSession(userId);
}

export async function discardCloudLedgerStateBeforeSignOut(userId: UserId | null): Promise<void> {
  if (userId === null) return;

  try {
    await discardCloudLedgerOutbox(userId);
    await deleteCloudLedgerTransactionCache(userId);
    clearCloudLedgerRuntimeCache(userId);
  } catch (err) {
    resumeCloudLedgerStateForUser(userId);
    captureCloudLedgerSessionCleanupFailure("auth_signout_cloud_ledger_outbox_discard_failed", err);
    throw err;
  }
}

export async function discardCloudLedgerStateAfterDeletedAccount(
  userId: UserId | null
): Promise<void> {
  if (userId === null) return;

  // Best effort before the destructive DB reset; resetDbForUser is the required fallback.
  await runDeletedAccountCleanupStep("auth_deleted_account_cloud_ledger_cache_cleanup_failed", () =>
    deleteCloudLedgerTransactionCache(userId)
  );

  const resetFailure = await runDeletedAccountCleanupStep(
    "auth_deleted_account_local_database_reset_failed",
    () => resetDbForUser(userId)
  );

  const outboxFailure = await runDeletedAccountCleanupStep(
    "auth_deleted_account_cloud_ledger_outbox_cleanup_failed",
    () => discardCloudLedgerOutbox(userId)
  );

  const runtimeFailure = runDeletedAccountRuntimeCleanupStep(userId);
  const blockingFailure = resetFailure ?? outboxFailure ?? runtimeFailure;
  if (blockingFailure !== null) throw blockingFailure.error;
}

async function runDeletedAccountCleanupStep(
  event: string,
  cleanup: () => Promise<void>
): Promise<DeletedAccountCleanupFailure | null> {
  try {
    await cleanup();
    return null;
  } catch (err) {
    captureCloudLedgerSessionCleanupFailure(event, err);
    return { error: err };
  }
}

function runDeletedAccountRuntimeCleanupStep(userId: UserId): DeletedAccountCleanupFailure | null {
  try {
    clearCloudLedgerRuntimeCache(userId);
    return null;
  } catch (err) {
    captureCloudLedgerSessionCleanupFailure(
      "auth_deleted_account_cloud_ledger_runtime_cleanup_failed",
      err
    );
    return { error: err };
  }
}
