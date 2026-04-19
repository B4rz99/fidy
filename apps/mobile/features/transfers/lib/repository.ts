import { and, desc, eq, isNull } from "drizzle-orm";
import { type AnyDb, enqueueSync, transfers } from "@/shared/db";
import { generateSyncQueueId } from "@/shared/lib";

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
    .orderBy(desc(transfers.date), desc(transfers.updatedAt))
    .all();
}
