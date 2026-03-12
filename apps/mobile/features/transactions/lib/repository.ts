import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { syncMeta, syncQueue, transactions } from "@/shared/db/schema";

export type SyncOperation = "insert" | "update" | "delete";
export type SyncTableName = "transactions";

export type TransactionRow = typeof transactions.$inferInsert;

export function insertTransaction(db: AnyDb, row: TransactionRow) {
  db.insert(transactions).values(row).run();
}

export function getAllTransactions(db: AnyDb, userId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date))
    .all();
}

export function softDeleteTransaction(db: AnyDb, id: string, now: string) {
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id))
    .run();
}

export function getTransactionById(db: AnyDb, id: string) {
  const rows = db.select().from(transactions).where(eq(transactions.id, id)).all();
  return rows[0] ?? null;
}

export function upsertTransaction(db: AnyDb, row: TransactionRow) {
  db.insert(transactions)
    .values(row)
    .onConflictDoUpdate({
      target: transactions.id,
      set: {
        type: row.type,
        amountCents: row.amountCents,
        categoryId: row.categoryId,
        description: row.description,
        date: row.date,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

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

export function getQueuedSyncEntries(db: AnyDb) {
  return db.select().from(syncQueue).all();
}

export function clearSyncEntries(db: AnyDb, ids: string[]) {
  if (ids.length === 0) return;
  db.delete(syncQueue).where(inArray(syncQueue.id, ids)).run();
}

export function getSyncMeta(db: AnyDb, key: string) {
  const rows = db.select().from(syncMeta).where(eq(syncMeta.key, key)).all();
  return rows[0]?.value ?? null;
}

export function setSyncMeta(db: AnyDb, key: string, value: string) {
  db.insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } })
    .run();
}
