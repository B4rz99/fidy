import { desc, eq } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { transactions } from "@/shared/db/schema";

// biome-ignore lint/suspicious/noExplicitAny: drizzle generic varies by caller
type AnyDb = ExpoSQLiteDatabase<any>;

export type TransactionRow = typeof transactions.$inferInsert;

export async function insertTransaction(db: AnyDb, row: TransactionRow) {
  await db.insert(transactions).values(row);
}

export async function getAllTransactions(db: AnyDb) {
  return db.select().from(transactions).orderBy(desc(transactions.date));
}

export async function deleteTransaction(db: AnyDb, id: string) {
  await db.delete(transactions).where(eq(transactions.id, id));
}
