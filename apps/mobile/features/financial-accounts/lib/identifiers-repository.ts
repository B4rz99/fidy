import { and, eq, isNull } from "drizzle-orm";
import { type AnyDb, enqueueSync, financialAccountIdentifiers, syncQueue } from "@/shared/db";
import { generateSyncQueueId } from "@/shared/lib";

export type FinancialAccountIdentifierRow = typeof financialAccountIdentifiers.$inferInsert;

export function getFinancialAccountIdentifierById(
  db: AnyDb,
  id: FinancialAccountIdentifierRow["id"]
) {
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

function deleteFinancialAccountIdentifierDuplicate(
  db: AnyDb,
  duplicateId: FinancialAccountIdentifierRow["id"]
) {
  db.delete(syncQueue)
    .where(
      and(eq(syncQueue.tableName, "financialAccountIdentifiers"), eq(syncQueue.rowId, duplicateId))
    )
    .run();
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

export function upsertFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  db.transaction((tx) => {
    const existingById = getFinancialAccountIdentifierById(tx, row.id);
    const activeDuplicate =
      row.deletedAt == null ? findActiveFinancialAccountIdentifierByUniqueKey(tx, row) : null;
    const duplicate = activeDuplicate?.id !== row.id ? activeDuplicate : null;

    if (existingById && existingById.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate) {
      deleteFinancialAccountIdentifierDuplicate(tx, duplicate.id);
    }

    persistFinancialAccountIdentifier(tx, row);
  });
}

export function saveFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  db.transaction((tx) => {
    const existingById = getFinancialAccountIdentifierById(tx, row.id);
    const activeDuplicate =
      row.deletedAt == null ? findActiveFinancialAccountIdentifierByUniqueKey(tx, row) : null;
    const duplicate = activeDuplicate?.id !== row.id ? activeDuplicate : null;

    if (existingById && duplicate) {
      deleteFinancialAccountIdentifierDuplicate(tx, duplicate.id);
    }

    const persistedRow =
      existingById == null && duplicate
        ? {
            ...row,
            id: duplicate.id,
            createdAt: duplicate.createdAt,
          }
        : row;

    persistFinancialAccountIdentifier(tx, persistedRow);

    enqueueSync(tx, {
      id: generateSyncQueueId(),
      tableName: "financialAccountIdentifiers",
      rowId: persistedRow.id,
      operation: existingById || duplicate ? "update" : "insert",
      createdAt: row.updatedAt,
    });
  });
}
