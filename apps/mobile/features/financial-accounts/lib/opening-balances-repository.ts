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

function findActiveOpeningBalanceByAccountId(db: AnyDb, accountId: OpeningBalanceRow["accountId"]) {
  const rows = db
    .select()
    .from(openingBalances)
    .where(and(eq(openingBalances.accountId, accountId), isNull(openingBalances.deletedAt)))
    .all();
  return rows[0] ?? null;
}

function deleteOpeningBalanceDuplicate(db: AnyDb, duplicateId: OpeningBalanceRow["id"]) {
  db.delete(syncQueue)
    .where(and(eq(syncQueue.tableName, "openingBalances"), eq(syncQueue.rowId, duplicateId)))
    .run();
  db.delete(openingBalances).where(eq(openingBalances.id, duplicateId)).run();
}

function persistOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.insert(openingBalances)
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
}

export function upsertOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.transaction((tx) => {
    const existingById = getOpeningBalanceById(tx, row.id);
    const activeDuplicate =
      row.deletedAt == null ? findActiveOpeningBalanceByAccountId(tx, row.accountId) : null;
    const duplicate = activeDuplicate?.id !== row.id ? activeDuplicate : null;

    if (existingById && existingById.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate) {
      deleteOpeningBalanceDuplicate(tx, duplicate.id);
    }

    persistOpeningBalance(tx, row);
  });
}

export function saveOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.transaction((tx) => {
    const existingById = getOpeningBalanceById(tx, row.id);
    const activeDuplicate =
      row.deletedAt == null ? findActiveOpeningBalanceByAccountId(tx, row.accountId) : null;
    const duplicate = activeDuplicate?.id !== row.id ? activeDuplicate : null;

    if (existingById && duplicate) {
      deleteOpeningBalanceDuplicate(tx, duplicate.id);
    }

    const persistedRow =
      existingById == null && duplicate
        ? {
            ...row,
            id: duplicate.id,
            createdAt: duplicate.createdAt,
          }
        : row;

    persistOpeningBalance(tx, persistedRow);

    enqueueSync(tx, {
      id: generateSyncQueueId(),
      tableName: "openingBalances",
      rowId: persistedRow.id,
      operation: existingById || duplicate ? "update" : "insert",
      createdAt: row.updatedAt,
    });
  });
}
