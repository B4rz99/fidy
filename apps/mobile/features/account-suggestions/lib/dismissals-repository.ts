import { and, eq, isNull } from "drizzle-orm";
import { type AnyDb, accountSuggestionDismissals } from "@/shared/db";

export type AccountSuggestionDismissalRow = typeof accountSuggestionDismissals.$inferInsert;
type ActiveDismissalLookupInput = {
  readonly db: AnyDb;
  readonly userId: AccountSuggestionDismissalRow["userId"];
  readonly scope: AccountSuggestionDismissalRow["scope"];
  readonly value: AccountSuggestionDismissalRow["value"];
};

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

export function getActiveAccountSuggestionDismissal(input: ActiveDismissalLookupInput) {
  const rows = input.db
    .select()
    .from(accountSuggestionDismissals)
    .where(
      and(
        eq(accountSuggestionDismissals.userId, input.userId),
        eq(accountSuggestionDismissals.scope, input.scope),
        eq(accountSuggestionDismissals.value, input.value),
        isNull(accountSuggestionDismissals.deletedAt)
      )
    )
    .all();
  return rows[0] ?? null;
}

function deleteDismissalDuplicate(db: AnyDb, duplicateId: AccountSuggestionDismissalRow["id"]) {
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

function getActiveDuplicateDismissal(db: AnyDb, row: AccountSuggestionDismissalRow) {
  const activeDuplicate =
    row.deletedAt == null
      ? getActiveAccountSuggestionDismissal({
          db,
          userId: row.userId,
          scope: row.scope,
          value: row.value,
        })
      : null;

  return activeDuplicate?.id !== row.id ? activeDuplicate : null;
}

function shouldSkipDismissalPersist(
  existingById: AccountSuggestionDismissalRow | null,
  duplicate: AccountSuggestionDismissalRow | null,
  row: AccountSuggestionDismissalRow
) {
  return (
    (existingById != null && existingById.updatedAt >= row.updatedAt) ||
    (duplicate != null && duplicate.updatedAt >= row.updatedAt)
  );
}

function upsertDismissalInTransaction(db: AnyDb, row: AccountSuggestionDismissalRow) {
  const existingById = getAccountSuggestionDismissalById(db, row.id);
  const duplicate = getActiveDuplicateDismissal(db, row);
  if (shouldSkipDismissalPersist(existingById, duplicate, row)) {
    return;
  }

  if (duplicate) {
    deleteDismissalDuplicate(db, duplicate.id);
  }

  persistAccountSuggestionDismissal(db, row);
}

function saveDismissalInTransaction(db: AnyDb, row: AccountSuggestionDismissalRow) {
  const existingById = getAccountSuggestionDismissalById(db, row.id);
  const duplicate = getActiveDuplicateDismissal(db, row);
  if (existingById && duplicate) {
    deleteDismissalDuplicate(db, duplicate.id);
  }

  const persistedRow =
    existingById == null && duplicate
      ? {
          ...row,
          id: duplicate.id,
          createdAt: duplicate.createdAt,
        }
      : row;
  persistAccountSuggestionDismissal(db, persistedRow);
}

export function upsertAccountSuggestionDismissal(db: AnyDb, row: AccountSuggestionDismissalRow) {
  db.transaction((tx) => upsertDismissalInTransaction(tx, row));
}

export function saveAccountSuggestionDismissal(db: AnyDb, row: AccountSuggestionDismissalRow) {
  db.transaction((tx) => saveDismissalInTransaction(tx, row));
}
