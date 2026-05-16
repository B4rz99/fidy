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
export {
  acceptSourceEventFinancialMeaningReviewById,
  dismissSourceEventFinancialMeaningReviewById,
  getFinancialMeaningSourceEventReviewRows,
  getPendingRetryEmailSourceEvents,
  getProcessedEmailSourceEventIds,
  getSourceEventReviewCandidateById,
  insertProcessedEmailSourceEvent,
  markSourceEventForRetry,
  markSourceEventPermanentlyFailed,
  markSourceEventRetrySuccess,
  updateProcessedSourceEventStatus,
  type FinancialMeaningSourceEventReviewRow,
  type ProcessedSourceEventRow,
} from "./source-event-repository";
export {
  getFailedEmailSourceEvents,
  getNeedsReviewEmailSourceEvents,
} from "./source-event-queue-repository";

export type EmailAccountRow = typeof emailAccounts.$inferInsert;
export type ProcessedEmailRow = typeof processedEmails.$inferInsert;
type ProcessedEmailStatusUpdateInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
};
type RetryScheduleInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly retryCount: number;
  readonly nextRetryAt: IsoDateTime;
};
type RetrySuccessInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: "success" | "needs_review";
  readonly transactionId: TransactionId | null;
  readonly confidence: number;
};

export async function insertEmailAccount(db: AnyDb, row: EmailAccountRow): Promise<boolean> {
  const result = await db.insert(emailAccounts).values(row).onConflictDoNothing().run();
  return result.changes > 0;
}

export async function getEmailAccount(db: AnyDb, id: EmailAccountId) {
  const rows = await db.select().from(emailAccounts).where(eq(emailAccounts.id, id));
  return rows[0] ?? null;
}

export async function getEmailAccounts(db: AnyDb, userId: UserId) {
  return db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
}

export async function deleteEmailAccount(db: AnyDb, id: EmailAccountId) {
  await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
}

export async function updateLastFetchedAt(db: AnyDb, id: EmailAccountId, timestamp: IsoDateTime) {
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

export async function getProcessedEmailById(db: AnyDb, id: ProcessedEmailId) {
  const rows = await db.select().from(processedEmails).where(eq(processedEmails.id, id));
  return rows[0] ?? null;
}

const getLegacyEmailSourceEventKey = (row: {
  readonly provider: string;
  readonly externalId: string;
}) => `${row.provider === "outlook" ? "email_outlook" : "email_gmail"}:${row.externalId}`;

async function canUseLegacyProcessedEmailFallback(db: AnyDb, userId: UserId) {
  const owners = await db
    .selectDistinct({ userId: emailAccounts.userId })
    .from(emailAccounts)
    .limit(2);
  return owners.length === 1 && owners[0]?.userId === userId;
}

export async function getProcessedExternalIds(
  db: AnyDb,
  userId: UserId,
  sourceEvents: readonly { readonly provider: string; readonly externalId: string }[]
) {
  if (sourceEvents.length === 0) return new Set<string>();
  if (!(await canUseLegacyProcessedEmailFallback(db, userId))) return new Set<string>();
  const rows = await db
    .select({ externalId: processedEmails.externalId, provider: processedEmails.provider })
    .from(processedEmails)
    .where(
      inArray(
        processedEmails.externalId,
        sourceEvents.map((event) => event.externalId)
      )
    );
  return new Set(rows.map(getLegacyEmailSourceEventKey));
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

export async function getNeedsReviewEmailByTransactionId(db: AnyDb, transactionId: TransactionId) {
  const rows = await db
    .select()
    .from(processedEmails)
    .where(
      and(
        eq(processedEmails.transactionId, transactionId),
        eq(processedEmails.status, "needs_review")
      )
    )
    .orderBy(desc(processedEmails.receivedAt))
    .limit(1);

  return rows[0] ?? null;
}

function getProcessedEmailUpdateQuery(
  db: AnyDb,
  id: ProcessedEmailId,
  fields: Partial<ProcessedEmailRow>
) {
  return db.update(processedEmails).set(fields).where(eq(processedEmails.id, id));
}

export async function updateProcessedEmailStatus(input: ProcessedEmailStatusUpdateInput) {
  await getProcessedEmailUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
  });
}

export function updateProcessedEmailStatusInTransaction(input: ProcessedEmailStatusUpdateInput) {
  getProcessedEmailUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
  }).run();
}

export async function dismissProcessedEmail(db: AnyDb, id: ProcessedEmailId) {
  await db.delete(processedEmails).where(eq(processedEmails.id, id));
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

export async function markForRetry(input: RetryScheduleInput) {
  await getProcessedEmailUpdateQuery(input.db, input.id, {
    status: "pending_retry",
    retryCount: input.retryCount,
    nextRetryAt: input.nextRetryAt,
  });
}

export async function markPermanentlyFailed(db: AnyDb, id: ProcessedEmailId) {
  await db
    .update(processedEmails)
    .set({ status: "failed", rawBody: null })
    .where(eq(processedEmails.id, id));
}

export async function markRetrySuccess(input: RetrySuccessInput) {
  await getProcessedEmailUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
    confidence: input.confidence,
    rawBody: null,
  });
}
