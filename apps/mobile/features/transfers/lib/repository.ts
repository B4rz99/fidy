import { and, desc, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { transfers } from "@/shared/db/schema";

export type TransferRow = typeof transfers.$inferInsert;
type GetTransfersPageInput = {
  readonly db: AnyDb;
  readonly userId: TransferRow["userId"];
  readonly limit: number;
  readonly offset: number;
};

function queryActiveTransfers(db: AnyDb, userId: TransferRow["userId"]) {
  return db
    .select()
    .from(transfers)
    .where(and(eq(transfers.userId, userId), isNull(transfers.deletedAt)))
    .orderBy(desc(transfers.date), desc(transfers.updatedAt), desc(transfers.id));
}

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
        source: row.source,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function saveTransfer(db: AnyDb, row: TransferRow) {
  upsertTransfer(db, row);
}

export function getTransfersForUser(db: AnyDb, userId: TransferRow["userId"]) {
  return queryActiveTransfers(db, userId).all();
}

export function getTransfersPaginated(input: GetTransfersPageInput) {
  const { db, userId, limit, offset } = input;
  return queryActiveTransfers(db, userId)
    .limit(limit + 1)
    .offset(offset)
    .all();
}
