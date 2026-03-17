import type { AnyDb } from "@/shared/db/client";
import { syncQueue } from "@/shared/db/schema";

export type SyncOperation = "insert" | "update" | "delete";
export type SyncTableName = "transactions";

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
