import { and, eq, isNull } from "drizzle-orm";
import { type AnyDb, openingBalances } from "@/shared/db";

export type OpeningBalanceRow = typeof openingBalances.$inferInsert;

function getOpeningBalanceById(db: AnyDb, id: OpeningBalanceRow["id"]) {
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
}

export function saveOpeningBalance(db: AnyDb, row: OpeningBalanceRow) {
  db.transaction((tx) => saveOpeningBalanceInTransaction(tx, row));
}
