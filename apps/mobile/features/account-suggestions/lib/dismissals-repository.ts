import { and, eq, isNull } from "drizzle-orm";
import { type AnyDb, accountSuggestionDismissals, enqueueSync, syncQueue } from "@/shared/db";
import { generateSyncQueueId } from "@/shared/lib";

export type AccountSuggestionDismissalRow = typeof accountSuggestionDismissals.$inferInsert;

export function getAccountSuggestionDismissalById(
  db: AnyDb,
  id: AccountSuggestionDismissalRow["id"]
) {
  const rows = db
    .select()
    .from(accountSuggestionDismissals)
    .where(eq(accountSuggestionDismissals.id, id))
    .all();
  return rows[0] ?? null;
}

export function getAccountSuggestionDismissalsForUser(
  db: AnyDb,
  userId: AccountSuggestionDismissalRow["userId"]
) {
  return db
    .select()
    .from(accountSuggestionDismissals)
    .where(
      and(
        eq(accountSuggestionDismissals.userId, userId),
        isNull(accountSuggestionDismissals.deletedAt)
      )
    )
    .all();
}

export function getActiveAccountSuggestionDismissal(
  db: AnyDb,
  userId: AccountSuggestionDismissalRow["userId"],
  scope: AccountSuggestionDismissalRow["scope"],
  value: AccountSuggestionDismissalRow["value"]
) {
  const rows = db
    .select()
    .from(accountSuggestionDismissals)
    .where(
      and(
        eq(accountSuggestionDismissals.userId, userId),
        eq(accountSuggestionDismissals.scope, scope),
        eq(accountSuggestionDismissals.value, value),
        isNull(accountSuggestionDismissals.deletedAt)
      )
    )
    .all();
  return rows[0] ?? null;
}

function deleteDismissalDuplicate(db: AnyDb, duplicateId: AccountSuggestionDismissalRow["id"]) {
  db.delete(syncQueue)
    .where(
      and(eq(syncQueue.tableName, "accountSuggestionDismissals"), eq(syncQueue.rowId, duplicateId))
    )
    .run();
  db.delete(accountSuggestionDismissals)
    .where(eq(accountSuggestionDismissals.id, duplicateId))
    .run();
}

function persistAccountSuggestionDismissal(db: AnyDb, row: AccountSuggestionDismissalRow) {
  db.insert(accountSuggestionDismissals)
    .values(row)
    .onConflictDoUpdate({
      target: accountSuggestionDismissals.id,
      set: {
        userId: row.userId,
        scope: row.scope,
        value: row.value,
        dismissedScore: row.dismissedScore,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function upsertAccountSuggestionDismissal(db: AnyDb, row: AccountSuggestionDismissalRow) {
  db.transaction((tx) => {
    const existingById = getAccountSuggestionDismissalById(tx, row.id);
    const activeDuplicate =
      row.deletedAt == null
        ? getActiveAccountSuggestionDismissal(tx, row.userId, row.scope, row.value)
        : null;
    const duplicate = activeDuplicate?.id !== row.id ? activeDuplicate : null;

    if (existingById && existingById.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate && duplicate.updatedAt >= row.updatedAt) {
      return;
    }

    if (duplicate) {
      deleteDismissalDuplicate(tx, duplicate.id);
    }

    persistAccountSuggestionDismissal(tx, row);
  });
}

export function saveAccountSuggestionDismissal(db: AnyDb, row: AccountSuggestionDismissalRow) {
  db.transaction((tx) => {
    const existingById = getAccountSuggestionDismissalById(tx, row.id);
    const activeDuplicate =
      row.deletedAt == null
        ? getActiveAccountSuggestionDismissal(tx, row.userId, row.scope, row.value)
        : null;
    const duplicate = activeDuplicate?.id !== row.id ? activeDuplicate : null;

    if (existingById && duplicate) {
      deleteDismissalDuplicate(tx, duplicate.id);
    }

    const persistedRow =
      existingById == null && duplicate
        ? {
            ...row,
            id: duplicate.id,
            createdAt: duplicate.createdAt,
          }
        : row;

    persistAccountSuggestionDismissal(tx, persistedRow);

    enqueueSync(tx, {
      id: generateSyncQueueId(),
      tableName: "accountSuggestionDismissals",
      rowId: persistedRow.id,
      operation: existingById || duplicate ? "update" : "insert",
      createdAt: row.updatedAt,
    });
  });
}
