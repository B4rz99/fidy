import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { emailAccounts, processedEmails } from "@/shared/db";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type EmailAccountRow = typeof emailAccounts.$inferInsert;
export type ProcessedEmailRow = typeof processedEmails.$inferInsert;

export async function insertEmailAccount(db: AnyDb, row: EmailAccountRow) {
  await db.insert(emailAccounts).values(row);
}

export async function getEmailAccount(db: AnyDb, id: string) {
  const rows = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, id as EmailAccountId));
  return rows[0] ?? null;
}

export async function getEmailAccounts(db: AnyDb, userId: string) {
  return db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.userId, userId as UserId));
}

export async function deleteEmailAccount(db: AnyDb, id: string) {
  await db.delete(emailAccounts).where(eq(emailAccounts.id, id as EmailAccountId));
}

export async function updateLastFetchedAt(db: AnyDb, id: string, timestamp: string) {
  await db
    .update(emailAccounts)
    .set({ lastFetchedAt: timestamp as IsoDateTime })
    .where(eq(emailAccounts.id, id as EmailAccountId));
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

export async function getProcessedExternalIds(db: AnyDb, externalIds: string[]) {
  if (externalIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ externalId: processedEmails.externalId })
    .from(processedEmails)
    .where(inArray(processedEmails.externalId, externalIds));
  return new Set(rows.map((r) => r.externalId));
}

export async function getFailedEmails(db: AnyDb) {
  return db
    .select()
    .from(processedEmails)
    .where(eq(processedEmails.status, "failed"))
    .orderBy(desc(processedEmails.receivedAt));
}

export async function getNeedsReviewEmails(db: AnyDb) {
  return db
    .select()
    .from(processedEmails)
    .where(eq(processedEmails.status, "needs_review"))
    .orderBy(desc(processedEmails.receivedAt));
}

export async function updateProcessedEmailStatus(
  db: AnyDb,
  id: string,
  status: string,
  transactionId: string | null
) {
  await db
    .update(processedEmails)
    .set({ status, transactionId: transactionId as TransactionId | null })
    .where(eq(processedEmails.id, id as ProcessedEmailId));
}

export async function dismissProcessedEmail(db: AnyDb, id: string) {
  await db.delete(processedEmails).where(eq(processedEmails.id, id as ProcessedEmailId));
}

export async function getPendingRetryEmails(db: AnyDb) {
  return db
    .select()
    .from(processedEmails)
    .where(
      and(
        eq(processedEmails.status, "pending_retry"),
        lte(processedEmails.nextRetryAt, sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
      )
    )
    .orderBy(desc(processedEmails.receivedAt))
    .limit(50);
}

export async function markForRetry(db: AnyDb, id: string, retryCount: number, nextRetryAt: string) {
  await db
    .update(processedEmails)
    .set({ status: "pending_retry", retryCount, nextRetryAt: nextRetryAt as IsoDateTime })
    .where(eq(processedEmails.id, id as ProcessedEmailId));
}

export async function markPermanentlyFailed(db: AnyDb, id: string) {
  await db
    .update(processedEmails)
    .set({ status: "failed", rawBody: null })
    .where(eq(processedEmails.id, id as ProcessedEmailId));
}

export async function markRetrySuccess(
  db: AnyDb,
  id: string,
  status: "success" | "needs_review",
  transactionId: string,
  confidence: number
) {
  await db
    .update(processedEmails)
    .set({ status, transactionId: transactionId as TransactionId, confidence, rawBody: null })
    .where(eq(processedEmails.id, id as ProcessedEmailId));
}
