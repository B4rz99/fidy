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

function findFinancialAccountIdentifierByUniqueKey(db: AnyDb, row: FinancialAccountIdentifierRow) {
  const rows = db
    .select()
    .from(financialAccountIdentifiers)
    .where(
      and(
        eq(financialAccountIdentifiers.userId, row.userId),
        eq(financialAccountIdentifiers.accountId, row.accountId),
        eq(financialAccountIdentifiers.scope, row.scope),
        eq(financialAccountIdentifiers.value, row.value)
      )
    )
    .all();
  return rows[0] ?? null;
}

export function upsertFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  db.transaction((tx) => {
    const existingById = getFinancialAccountIdentifierById(tx, row.id);
    const existingByUnique = findFinancialAccountIdentifierByUniqueKey(tx, row);
    const duplicate = existingById ? null : existingByUnique;

    if (existingById && existingById.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.id !== row.id && duplicate.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.id !== row.id) {
      tx.delete(syncQueue)
        .where(
          and(
            eq(syncQueue.tableName, "financialAccountIdentifiers"),
            eq(syncQueue.rowId, duplicate.id)
          )
        )
        .run();
      tx.delete(financialAccountIdentifiers)
        .where(eq(financialAccountIdentifiers.id, duplicate.id))
        .run();
    }

    tx.insert(financialAccountIdentifiers)
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
  });
}

export function saveFinancialAccountIdentifier(db: AnyDb, row: FinancialAccountIdentifierRow) {
  const existing =
    getFinancialAccountIdentifierById(db, row.id) ??
    findFinancialAccountIdentifierByUniqueKey(db, row) ??
    null;

  db.insert(financialAccountIdentifiers)
    .values(row)
    .onConflictDoUpdate({
      target: [
        financialAccountIdentifiers.userId,
        financialAccountIdentifiers.accountId,
        financialAccountIdentifiers.scope,
        financialAccountIdentifiers.value,
      ],
      set: {
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "financialAccountIdentifiers",
    rowId: existing?.id ?? row.id,
    operation: existing ? "update" : "insert",
    createdAt: row.updatedAt,
  });
}
