import { desc, eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { emailAccounts, processedEmails } from "@/shared/db/schema";

export type EmailAccountRow = typeof emailAccounts.$inferInsert;
export type ProcessedEmailRow = typeof processedEmails.$inferInsert;

export async function insertEmailAccount(db: AnyDb, row: EmailAccountRow) {
  await db.insert(emailAccounts).values(row);
}

export async function getEmailAccounts(db: AnyDb, userId: string) {
  return db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
}

export async function deleteEmailAccount(db: AnyDb, id: string) {
  await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
}

export async function updateLastFetchedAt(db: AnyDb, id: string, timestamp: string) {
  await db.update(emailAccounts).set({ lastFetchedAt: timestamp }).where(eq(emailAccounts.id, id));
}

export async function insertProcessedEmail(db: AnyDb, row: ProcessedEmailRow) {
  await db.insert(processedEmails).values(row);
}

export async function getProcessedEmailByExternalId(db: AnyDb, externalId: string) {
  const rows = await db
    .select()
    .from(processedEmails)
    .where(eq(processedEmails.externalId, externalId));
  return rows[0] ?? null;
}

export async function getFailedEmails(db: AnyDb) {
  return db
    .select()
    .from(processedEmails)
    .where(eq(processedEmails.status, "failed"))
    .orderBy(desc(processedEmails.receivedAt));
}

export async function dismissProcessedEmail(db: AnyDb, id: string) {
  await db.delete(processedEmails).where(eq(processedEmails.id, id));
}
