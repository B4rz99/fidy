import { desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { syncConflicts } from "@/shared/db";
import type { IsoDateTime, SyncConflictId } from "@/shared/types/branded";

export type ConflictRow = typeof syncConflicts.$inferInsert;

export function insertConflict(db: AnyDb, row: ConflictRow) {
  db.insert(syncConflicts).values(row).run();
}

export function getUnresolvedConflicts(db: AnyDb) {
  return db
    .select()
    .from(syncConflicts)
    .where(isNull(syncConflicts.resolvedAt))
    .orderBy(desc(syncConflicts.detectedAt))
    .all();
}

export function resolveConflict(
  db: AnyDb,
  id: SyncConflictId,
  resolution: string,
  resolvedAt: IsoDateTime
) {
  db.update(syncConflicts).set({ resolvedAt, resolution }).where(eq(syncConflicts.id, id)).run();
}
