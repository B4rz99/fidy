import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { syncMeta, syncQueue, transactions } from "@/shared/db/schema";

export type SyncOperation = "insert" | "update" | "delete";
export type SyncTableName = "transactions";

export type TransactionRow = typeof transactions.$inferInsert;

export async function insertTransaction(db: AnyDb, row: TransactionRow) {
  await db.insert(transactions).values(row);
}

export async function getAllTransactions(db: AnyDb, userId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date));
}

export async function softDeleteTransaction(db: AnyDb, id: string) {
  const now = new Date().toISOString();
  await db
    .update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id));
}

export async function getTransactionById(db: AnyDb, id: string) {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id));
  return rows[0] ?? null;
}

export async function upsertTransaction(db: AnyDb, row: TransactionRow) {
  await db
    .insert(transactions)
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
    });
}

export type SyncQueueEntry = {
  id: string;
  tableName: SyncTableName;
  rowId: string;
  operation: SyncOperation;
  createdAt: string;
};

export async function enqueueSync(db: AnyDb, entry: SyncQueueEntry) {
  await db.insert(syncQueue).values(entry);
}

export async function getQueuedSyncEntries(db: AnyDb) {
  return db.select().from(syncQueue);
}

export async function clearSyncEntries(db: AnyDb, ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(syncQueue).where(inArray(syncQueue.id, ids));
}

export async function getSyncMeta(db: AnyDb, key: string) {
  const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, key));
  return rows[0]?.value ?? null;
}

export async function setSyncMeta(db: AnyDb, key: string, value: string) {
  await db
    .insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } });
}
