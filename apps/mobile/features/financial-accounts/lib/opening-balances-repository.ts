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

function getActiveOpeningBalanceDuplicate(db: AnyDb, row: OpeningBalanceRow) {
  const activeDuplicate =
    row.deletedAt == null ? findActiveOpeningBalanceByAccountId(db, row.accountId) : null;
  return activeDuplicate?.id !== row.id ? activeDuplicate : null;
}

function shouldSkipOpeningBalancePersist(
  existingById: OpeningBalanceRow | null,
  duplicate: OpeningBalanceRow | null,
  row: OpeningBalanceRow
) {
  return (
    (existingById != null && existingById.updatedAt >= row.updatedAt) ||
    (duplicate != null && duplicate.updatedAt >= row.updatedAt)
  );
}

function upsertOpeningBalanceInTransaction(db: AnyDb, row: OpeningBalanceRow) {
  const existingById = getOpeningBalanceById(db, row.id);
  const duplicate = getActiveOpeningBalanceDuplicate(db, row);
  if (shouldSkipOpeningBalancePersist(existingById, duplicate, row)) {
    return;
  }

  if (duplicate) {
    deleteOpeningBalanceDuplicate(db, duplicate.id);
  }

  persistOpeningBalance(db, row);
}

function saveOpeningBalanceInTransaction(db: AnyDb, row: OpeningBalanceRow) {
  const existingById = getOpeningBalanceById(db, row.id);
  const duplicate = getActiveOpeningBalanceDuplicate(db, row);
  if (existingById && duplicate) {
    deleteOpeningBalanceDuplicate(db, duplicate.id);
  }

  const persistedRow =
    existingById == null && duplicate
      ? {
          ...row,
          id: duplicate.id,
          createdAt: duplicate.createdAt,
        }
      : row;

  persistOpeningBalance(db, persistedRow);

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "openingBalances",
    rowId: persistedRow.id,
    operation: existingById || duplicate ? "update" : "insert",
    createdAt: row.updatedAt,
  });
}

export function upsertOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.transaction((tx) => upsertOpeningBalanceInTransaction(tx, row));
}

export function saveOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.transaction((tx) => saveOpeningBalanceInTransaction(tx, row));
}
