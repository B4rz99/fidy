import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { accounts, transactions } from "@/shared/db/schema";
import type { AccountId, IsoDateTime, TransactionId, UserId } from "@/shared/types/branded";
import type { BankKey } from "../schema";

export type AccountRow = typeof accounts.$inferInsert;

export function insertAccount(db: AnyDb, row: AccountRow) {
  db.insert(accounts).values(row).run();
}

export function getAccountsByUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .orderBy(desc(accounts.isDefault), accounts.name)
    .all();
}

export function getAccountsByBankKey(db: AnyDb, userId: UserId, bankKey: BankKey) {
  return db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.bankKey, bankKey), isNull(accounts.deletedAt))
    )
    .all();
}

export function getDefaultAccount(db: AnyDb, userId: UserId) {
  const rows = db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.isDefault, true), isNull(accounts.deletedAt))
    )
    .all();
  return rows[0] ?? null;
}

export function getAccountById(db: AnyDb, id: AccountId) {
  const rows = db.select().from(accounts).where(eq(accounts.id, id)).all();
  return rows[0] ?? null;
}

export function setDefaultAccount(
  db: AnyDb,
  userId: UserId,
  accountId: AccountId,
  now: IsoDateTime
) {
  db.transaction((tx) => {
    const txDb = tx as unknown as AnyDb;
    txDb
      .update(accounts)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(eq(accounts.userId, userId), eq(accounts.isDefault, true), isNull(accounts.deletedAt))
      )
      .run();
    txDb
      .update(accounts)
      .set({ isDefault: true, updatedAt: now })
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, userId), isNull(accounts.deletedAt))
      )
      .run();
  });
}

export function softDeleteAccount(db: AnyDb, id: AccountId, now: IsoDateTime) {
  db.update(accounts).set({ deletedAt: now, updatedAt: now }).where(eq(accounts.id, id)).run();
}

export function updateAccount(
  db: AnyDb,
  id: AccountId,
  updates: Partial<
    Pick<AccountRow, "name" | "type" | "bankKey" | "identifiers" | "initialBalance">
  >,
  now: IsoDateTime
) {
  db.update(accounts)
    .set({ ...updates, updatedAt: now })
    .where(eq(accounts.id, id))
    .run();
}

export function getReviewCount(db: AnyDb, userId: UserId): number {
  const row = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.needsAccountReview, true),
        isNull(transactions.deletedAt)
      )
    )
    .get();
  return row?.count ?? 0;
}

export function reassignTransactionAccount(
  db: AnyDb,
  txId: TransactionId,
  accountId: AccountId,
  now: IsoDateTime
) {
  db.update(transactions)
    .set({ accountId, needsAccountReview: false, updatedAt: now })
    .where(eq(transactions.id, txId))
    .run();
}

export function getTransferCandidates(db: AnyDb, userId: UserId, dateFrom: string, dateTo: string) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      accountId: transactions.accountId,
      date: transactions.date,
      linkedTransactionId: transactions.linkedTransactionId,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.linkedTransactionId),
        ne(transactions.type, "transfer"),
        sql`${transactions.date} >= ${dateFrom}`,
        sql`${transactions.date} <= ${dateTo}`
      )
    )
    .all();
}

export function linkTransferPair(
  db: AnyDb,
  txA: TransactionId,
  txB: TransactionId,
  now: IsoDateTime
) {
  db.transaction((tx) => {
    const txDb = tx as unknown as AnyDb;
    txDb
      .update(transactions)
      .set({ linkedTransactionId: txB, type: "transfer", updatedAt: now })
      .where(eq(transactions.id, txA))
      .run();
    txDb
      .update(transactions)
      .set({ linkedTransactionId: txA, type: "transfer", updatedAt: now })
      .where(eq(transactions.id, txB))
      .run();
  });
}
