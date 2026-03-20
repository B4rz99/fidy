import type { AnyDb } from "./client";
import { syncQueue } from "./schema";

export type SyncOperation = "insert" | "update" | "delete";
export type SyncTableName = "transactions" | "budgets" | "goals" | "goalContributions";

export type SyncQueueEntry = {
  id: string;
  tableName: SyncTableName;
  rowId: string;
  operation: SyncOperation;
  createdAt: string;
};

export function enqueueSync(db: AnyDb, entry: SyncQueueEntry) {
  db.insert(syncQueue).values(entry).run();
}
