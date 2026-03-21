import type { IsoDateTime, SyncQueueId } from "@/shared/types/branded";
import type { AnyDb } from "./client";
import { syncQueue } from "./schema";

export type SyncOperation = "insert" | "update" | "delete";
export type SyncTableName = "transactions" | "budgets" | "goals" | "goalContributions";

export type SyncQueueEntry = {
  id: SyncQueueId;
  tableName: SyncTableName;
  rowId: string;
  operation: SyncOperation;
  createdAt: IsoDateTime;
};

export function enqueueSync(db: AnyDb, entry: SyncQueueEntry) {
  db.insert(syncQueue).values(entry).run();
}
