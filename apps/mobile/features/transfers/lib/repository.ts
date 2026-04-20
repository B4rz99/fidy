import { and, desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import { transfers } from "@/shared/db/schema";
import { generateSyncQueueId } from "@/shared/lib/generate-id";

export type TransferRow = typeof transfers.$inferInsert;

export function getTransferById(db: AnyDb, id: TransferRow["id"]) {
  const rows = db.select().from(transfers).where(eq(transfers.id, id)).all();
  return rows[0] ?? null;
}

export function upsertTransfer(db: AnyDb, row: TransferRow) {
  db.insert(transfers)
    .values(row)
    .onConflictDoUpdate({
      target: transfers.id,
      set: {
        userId: row.userId,
        amount: row.amount,
        fromAccountId: row.fromAccountId,
        toAccountId: row.toAccountId,
        fromExternalLabel: row.fromExternalLabel,
        toExternalLabel: row.toExternalLabel,
        description: row.description,
        date: row.date,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function saveTransfer(db: AnyDb, row: TransferRow) {
  const existing = getTransferById(db, row.id);

  upsertTransfer(db, row);

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "transfers",
    rowId: row.id,
    operation: existing ? "update" : "insert",
    createdAt: row.updatedAt,
  });
}

export function getTransfersForUser(db: AnyDb, userId: TransferRow["userId"]) {
  return db
    .select()
    .from(transfers)
    .where(and(eq(transfers.userId, userId), isNull(transfers.deletedAt)))
    .orderBy(desc(transfers.date), desc(transfers.updatedAt), desc(transfers.id))
    .all();
}

export function getTransfersPaginated(
  db: AnyDb,
  userId: TransferRow["userId"],
  limit: number,
  offset: number
) {
  return db
    .select()
    .from(transfers)
    .where(and(eq(transfers.userId, userId), isNull(transfers.deletedAt)))
    .orderBy(desc(transfers.date), desc(transfers.updatedAt), desc(transfers.id))
    .limit(limit + 1)
    .offset(offset)
    .all();
}
