import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { accounts } from "@/shared/db";
import type { AccountId, UserId } from "@/shared/types/branded";
import type { AccountSystemKey } from "../schema";

export type AccountRow = typeof accounts.$inferInsert;

export function insertAccount(db: AnyDb, row: AccountRow) {
  db.insert(accounts)
    .values(row)
    .onConflictDoNothing({
      target: [accounts.userId, accounts.systemKey],
    })
    .run();
}

export function getAccountById(db: AnyDb, id: AccountId) {
  const rows = db.select().from(accounts).where(eq(accounts.id, id)).all();
  return rows[0] ?? null;
}

export function getAccountsForUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.createdAt))
    .all();
}

export function getActiveAccountsForUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.createdAt))
    .all();
}

export function getAccountsBySystemKeys(
  db: AnyDb,
  userId: UserId,
  systemKeys: readonly AccountSystemKey[]
) {
  if (systemKeys.length === 0) return [];

  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.systemKey, systemKeys)))
    .orderBy(asc(accounts.createdAt))
    .all();
}

export function upsertAccount(db: AnyDb, row: AccountRow) {
  const set = {
    systemKey: row.systemKey,
    accountClass: row.accountClass,
    accountSubtype: row.accountSubtype,
    name: row.name,
    institution: row.institution,
    last4: row.last4,
    baselineAmount: row.baselineAmount,
    baselineDate: row.baselineDate,
    creditLimit: row.creditLimit,
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt,
  } as const;

  if (row.systemKey != null) {
    db.insert(accounts)
      .values(row)
      .onConflictDoUpdate({
        target: [accounts.userId, accounts.systemKey],
        set,
      })
      .run();
    return;
  }

  db.insert(accounts)
    .values(row)
    .onConflictDoUpdate({
      target: accounts.id,
      set,
    })
    .run();
}
