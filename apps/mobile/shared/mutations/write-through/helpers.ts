import type { SyncOperation, SyncTableName } from "@/shared/db";
import { generateBudgetId, generateSyncQueueId } from "@/shared/lib";
import type { BudgetId, IsoDateTime } from "@/shared/types/branded";

export function toSyncEntry(
  tableName: SyncTableName,
  rowId: string,
  operation: SyncOperation,
  createdAt: IsoDateTime
) {
  return {
    id: generateSyncQueueId(),
    tableName,
    rowId,
    operation,
    createdAt,
  };
}

export function createBudgetCopyId(): BudgetId {
  return generateBudgetId();
}
