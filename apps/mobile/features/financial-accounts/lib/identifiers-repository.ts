import { and, eq, isNull } from "drizzle-orm";
import { type AnyDb, financialAccountIdentifiers } from "@/shared/db";

export type FinancialAccountIdentifierRow = typeof financialAccountIdentifiers.$inferInsert;

function getFinancialAccountIdentifierById(db: AnyDb, id: FinancialAccountIdentifierRow["id"]) {
  const rows = db
    .select()
    .from(financialAccountIdentifiers)
    .where(eq(financialAccountIdentifiers.id, id))
    .all();
  return rows[0] ?? null;
}

export function getFinancialAccountIdentifiersForAccount(
  db: AnyDb,
  accountId: FinancialAccountIdentifierRow["accountId"]
) {
  return db
    .select()
    .from(financialAccountIdentifiers)
    .where(
      and(
        eq(financialAccountIdentifiers.accountId, accountId),
        isNull(financialAccountIdentifiers.deletedAt)
      )
    )
    .all();
}

export function getFinancialAccountIdentifiersForUser(
  db: AnyDb,
  userId: FinancialAccountIdentifierRow["userId"]
) {
  return db
    .select()
    .from(financialAccountIdentifiers)
    .where(
      and(
        eq(financialAccountIdentifiers.userId, userId),
        isNull(financialAccountIdentifiers.deletedAt)
      )
    )
    .all();
}

function findActiveFinancialAccountIdentifierByUniqueKey(
  db: AnyDb,
  row: FinancialAccountIdentifierRow
) {
  const rows = db
    .select()
    .from(financialAccountIdentifiers)
    .where(
      and(
        eq(financialAccountIdentifiers.userId, row.userId),
        eq(financialAccountIdentifiers.accountId, row.accountId),
        eq(financialAccountIdentifiers.scope, row.scope),
        eq(financialAccountIdentifiers.value, row.value),
        isNull(financialAccountIdentifiers.deletedAt)
      )
    )
    .all();
  return rows[0] ?? null;
}

function getFinancialAccountIdentifierDuplicate(db: AnyDb, row: FinancialAccountIdentifierRow) {
  const activeDuplicate =
    row.deletedAt == null ? findActiveFinancialAccountIdentifierByUniqueKey(db, row) : null;
  return activeDuplicate?.id !== row.id ? activeDuplicate : null;
}

function deleteFinancialAccountIdentifierDuplicate(
  db: AnyDb,
  duplicateId: FinancialAccountIdentifierRow["id"]
) {
  db.delete(financialAccountIdentifiers)
    .where(eq(financialAccountIdentifiers.id, duplicateId))
    .run();
}

function persistFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  db.insert(financialAccountIdentifiers)
    .values(row)
    .onConflictDoUpdate({
      target: financialAccountIdentifiers.id,
      set: {
        userId: row.userId,
        accountId: row.accountId,
        scope: row.scope,
        value: row.value,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

function shouldSkipFinancialAccountIdentifierUpsert(
  existingRow: FinancialAccountIdentifierRow | null,
  nextUpdatedAt: FinancialAccountIdentifierRow["updatedAt"]
) {
  return existingRow != null && existingRow.updatedAt >= nextUpdatedAt;
}

function upsertFinancialAccountIdentifierInTransaction(
  db: AnyDb,
  row: FinancialAccountIdentifierRow
) {
  const existingById = getFinancialAccountIdentifierById(db, row.id);
  const duplicate = getFinancialAccountIdentifierDuplicate(db, row);

  if (shouldSkipFinancialAccountIdentifierUpsert(existingById, row.updatedAt)) {
    return;
  }

  if (shouldSkipFinancialAccountIdentifierUpsert(duplicate, row.updatedAt)) {
    return;
  }

  if (duplicate != null) {
    deleteFinancialAccountIdentifierDuplicate(db, duplicate.id);
  }

  persistFinancialAccountIdentifier(db, row);
}

export function saveFinancialAccountIdentifierInTransaction(
  db: AnyDb,
  row: FinancialAccountIdentifierRow
) {
  const existingById = getFinancialAccountIdentifierById(db, row.id);
  const duplicate = getFinancialAccountIdentifierDuplicate(db, row);

  if (existingById && duplicate) {
    deleteFinancialAccountIdentifierDuplicate(db, duplicate.id);
  }

  const persistedRow =
    existingById == null && duplicate
      ? {
          ...row,
          id: duplicate.id,
          createdAt: duplicate.createdAt,
        }
      : row;

  persistFinancialAccountIdentifier(db, persistedRow);
}

export function upsertFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  db.transaction((tx) => {
    upsertFinancialAccountIdentifierInTransaction(tx, row);
  });
}

export function saveFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  db.transaction((tx) => {
    saveFinancialAccountIdentifierInTransaction(tx, row);
  });
}
