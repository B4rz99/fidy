import { clearSyncEntries } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import type { SyncQueueId } from "@/shared/types/branded";
import type { SyncPushOptions } from "./types";

const PRIVATE_BACKUP_SYNC_MODE = "privateBackup";
const DEFAULT_REMOTE_FINANCIAL_SYNC_MODE = PRIVATE_BACKUP_SYNC_MODE;
const PLAINTEXT_FINANCIAL_PUSH_TABLES = new Set<string>([
  "transactions",
  "budgets",
  "goals",
  "financialAccounts",
  "transfers",
  "openingBalances",
  "financialAccountIdentifiers",
  "captureEvidence",
  "accountSuggestionDismissals",
  "goalContributions",
]);

export type PushQueueEntry = { id: SyncQueueId; tableName: string; rowId: string };
export type PushQueueResult = PromiseSettledResult<SyncQueueId | null>;

export function shouldSkipPlaintextFinancialPush(tableName: string, options: SyncPushOptions) {
  const remoteFinancialSync = options.remoteFinancialSync ?? DEFAULT_REMOTE_FINANCIAL_SYNC_MODE;
  return (
    remoteFinancialSync === PRIVATE_BACKUP_SYNC_MODE &&
    PLAINTEXT_FINANCIAL_PUSH_TABLES.has(tableName)
  );
}

export function getProcessedSyncQueueIds(results: readonly PushQueueResult[]) {
  return results
    .filter(
      (result): result is PromiseFulfilledResult<SyncQueueId> =>
        result.status === "fulfilled" && result.value !== null
    )
    .map((result) => result.value);
}

export async function clearProcessedSyncEntries(db: AnyDb, processedIds: SyncQueueId[]) {
  if (processedIds.length === 0) {
    return;
  }

  await clearSyncEntries(db, processedIds);
}
