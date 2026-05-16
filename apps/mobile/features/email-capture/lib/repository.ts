import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { LocalLedgerReviewCandidateId } from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { emailAccounts, processedEmails } from "@/shared/db";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  reviewCandidateEmailSelect,
  toPendingRetrySourceEventRow,
  toProcessedEmailReadModel,
  toReviewCandidateEmailReadModel,
} from "./repository-mappers";

export type EmailAccountRow = typeof emailAccounts.$inferInsert;
export type ProcessedEmailRow = typeof processedEmails.$inferInsert;
export type EmailReviewRow = ProcessedEmailRow & {
  readonly reviewCandidateId?: LocalLedgerReviewCandidateId;
  readonly processedSourceEventId?: ProcessedSourceEventId;
  readonly reviewCandidateOccurredAt?: IsoDateTime | null;
  readonly reviewCandidateAmount?: number | null;
  readonly reviewCandidateDescription?: string | null;
};
type ProcessedSourceEventRow = typeof processedSourceEvents.$inferSelect;
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
type RetryTerminalStatusInput = {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
};
type PendingRetrySourceEventInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly row: ProcessedEmailRow;
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

export async function getProcessedExternalIds(db: AnyDb, externalIds: string[]) {
  if (externalIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ externalId: processedEmails.externalId })
    .from(processedEmails)
    .where(inArray(processedEmails.externalId, externalIds));
  return new Set(rows.map((r) => r.externalId));
}

export async function getFailedEmails(db: AnyDb, userId: UserId) {
  const rows = await db
    .select()
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "failed")
      )
    )
    .orderBy(desc(processedSourceEvents.receivedAt));

  return rows.map(toProcessedEmailReadModel);
}

export async function getNeedsReviewEmails(db: AnyDb, userId: UserId) {
  const rows = await db
    .select(reviewCandidateEmailSelect)
    .from(reviewCandidates)
    .innerJoin(
      processedSourceEvents,
      eq(reviewCandidates.processedSourceEventId, processedSourceEvents.id)
    )
    .where(
      and(
        eq(reviewCandidates.userId, userId),
        eq(processedSourceEvents.userId, userId),
        eq(reviewCandidates.status, "pending"),
        eq(reviewCandidates.candidateKind, "transaction"),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "needs_review")
      )
    )
    .orderBy(desc(processedSourceEvents.receivedAt));

  return rows.map(toReviewCandidateEmailReadModel);
}

export async function insertPendingRetrySourceEvent(input: PendingRetrySourceEventInput) {
  await input.db
    .insert(processedSourceEvents)
    .values(toPendingRetrySourceEventRow(input))
    .onConflictDoNothing()
    .run();
}

export async function getNeedsReviewEmailByTransactionId(
  db: AnyDb,
  transactionId: TransactionId
): Promise<ProcessedEmailRow | null> {
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
  await input.db
    .update(processedSourceEvents)
    .set({
      status: input.status,
      retryTransactionId: input.transactionId,
      retryRawBody: null,
      nextRetryAt: null,
    })
    .where(eq(processedSourceEvents.id, input.id as unknown as ProcessedSourceEventRow["id"]));
}

export function updateProcessedEmailStatusInTransaction(input: ProcessedEmailStatusUpdateInput) {
  getProcessedEmailUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
  }).run();
}

export async function dismissProcessedEmail(db: AnyDb, id: ProcessedEmailId) {
  await db
    .update(processedSourceEvents)
    .set({ status: "dismissed" })
    .where(eq(processedSourceEvents.id, id as unknown as ProcessedSourceEventRow["id"]));
}

export async function getPendingRetryEmails(db: AnyDb, userId: UserId) {
  const rows = await db
    .select()
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "pending_retry"),
        lte(processedSourceEvents.nextRetryAt, sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
      )
    )
    .orderBy(desc(processedSourceEvents.receivedAt))
    .limit(50);

  return rows.map(toProcessedEmailReadModel);
}

export async function markForRetry(input: RetryScheduleInput) {
  await input.db
    .update(processedSourceEvents)
    .set({
      status: "pending_retry",
      retryCount: input.retryCount,
      nextRetryAt: input.nextRetryAt,
    })
    .where(eq(processedSourceEvents.id, input.id as unknown as ProcessedSourceEventRow["id"]));
}

export async function markPermanentlyFailed(db: AnyDb, id: ProcessedEmailId) {
  await db
    .update(processedSourceEvents)
    .set({ status: "failed", retryRawBody: null, nextRetryAt: null })
    .where(eq(processedSourceEvents.id, id as unknown as ProcessedSourceEventRow["id"]));
}

export async function markRetrySuccess(input: RetrySuccessInput) {
  await input.db
    .update(processedSourceEvents)
    .set({
      status: input.status,
      retryTransactionId: input.transactionId,
      retryConfidence: input.confidence,
      retryRawBody: null,
      nextRetryAt: null,
    })
    .where(eq(processedSourceEvents.id, input.id as unknown as ProcessedSourceEventRow["id"]));
}

export async function markRetryTerminalStatus(input: RetryTerminalStatusInput) {
  await input.db
    .update(processedSourceEvents)
    .set({
      status: input.status,
      retryTransactionId: input.transactionId,
      retryRawBody: null,
      nextRetryAt: null,
    })
    .where(eq(processedSourceEvents.id, input.id as unknown as ProcessedSourceEventRow["id"]));
}
