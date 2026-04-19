import { and, eq, isNull } from "drizzle-orm";
import { type AnyDb, enqueueSync, openingBalances, syncQueue } from "@/shared/db";
import { generateSyncQueueId } from "@/shared/lib";

export type OpeningBalanceRow = typeof openingBalances.$inferInsert;

export function getOpeningBalanceById(db: AnyDb, id: OpeningBalanceRow["id"]) {
  const rows = db.select().from(openingBalances).where(eq(openingBalances.id, id)).all();
  return rows[0] ?? null;
}

export function getOpeningBalanceForAccount(db: AnyDb, accountId: OpeningBalanceRow["accountId"]) {
  const rows = db
    .select()
    .from(openingBalances)
    .where(and(eq(openingBalances.accountId, accountId), isNull(openingBalances.deletedAt)))
    .all();
  return rows[0] ?? null;
}

function findOpeningBalanceByAccountId(db: AnyDb, accountId: OpeningBalanceRow["accountId"]) {
  const rows = db
    .select()
    .from(openingBalances)
    .where(eq(openingBalances.accountId, accountId))
    .all();
  return rows[0] ?? null;
}

export function upsertOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.transaction((tx) => {
    const existingById = getOpeningBalanceById(tx, row.id);
    const existingByAccount = findOpeningBalanceByAccountId(tx, row.accountId);
    const duplicate = existingById ? null : existingByAccount;

    if (existingById && existingById.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.id !== row.id && duplicate.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.id !== row.id) {
      tx.delete(syncQueue)
        .where(and(eq(syncQueue.tableName, "openingBalances"), eq(syncQueue.rowId, duplicate.id)))
        .run();
      tx.delete(openingBalances).where(eq(openingBalances.id, duplicate.id)).run();
    }

    tx.insert(openingBalances)
      .values(row)
      .onConflictDoUpdate({
        target: openingBalances.id,
        set: {
          userId: row.userId,
          accountId: row.accountId,
          amount: row.amount,
          effectiveDate: row.effectiveDate,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        },
      })
      .run();
  });
}

export function saveOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  const existing =
    getOpeningBalanceById(db, row.id) ?? findOpeningBalanceByAccountId(db, row.accountId);

  db.insert(openingBalances)
    .values(row)
    .onConflictDoUpdate({
      target: openingBalances.accountId,
      set: {
        amount: row.amount,
        effectiveDate: row.effectiveDate,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "openingBalances",
    rowId: existing?.id ?? row.id,
    operation: existing ? "update" : "insert",
    createdAt: row.updatedAt,
  });
}
