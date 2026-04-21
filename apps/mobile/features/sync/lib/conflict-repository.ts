import { desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { syncConflicts } from "@/shared/db";
import type { IsoDateTime, SyncConflictId } from "@/shared/types/branded";

export type ConflictRow = typeof syncConflicts.$inferInsert;
type ResolveConflictInput = {
  readonly db: AnyDb;
  readonly id: SyncConflictId;
  readonly resolution: string;
  readonly resolvedAt: IsoDateTime;
};

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

export function resolveConflict(input: ResolveConflictInput) {
  input.db
    .update(syncConflicts)
    .set({ resolvedAt: input.resolvedAt, resolution: input.resolution })
    .where(eq(syncConflicts.id, input.id))
    .run();
}
