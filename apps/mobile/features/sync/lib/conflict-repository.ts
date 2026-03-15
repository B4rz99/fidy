import { desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { syncConflicts } from "@/shared/db/schema";

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

export function resolveConflict(db: AnyDb, id: string, resolution: string, resolvedAt: string) {
  db.update(syncConflicts).set({ resolvedAt, resolution }).where(eq(syncConflicts.id, id)).run();
}
