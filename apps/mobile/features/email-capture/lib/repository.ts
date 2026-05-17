import { eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { emailAccounts } from "@/shared/db/schema";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";
export {
  getPendingRetryEmailSourceEvents,
  getProcessedEmailSourceEventIds,
  insertProcessedEmailSourceEvent,
  markSourceEventForRetry,
  markSourceEventPermanentlyFailed,
  markSourceEventRetrySuccess,
  updateProcessedSourceEventStatus,
  updateProcessedSourceEventStatusInTransaction,
  type ProcessedSourceEventRow,
} from "./source-event-repository";
export {
  acceptSourceEventFinancialMeaningReviewById,
  dismissSourceEventFinancialMeaningReviewById,
  getFinancialMeaningSourceEventReviewRows,
  getSourceEventReviewCandidateById,
  markSourceEventReviewCandidateReclassifiedAsTransfer,
  type FinancialMeaningSourceEventReviewRow,
} from "./source-event-review-repository";
export {
  getFailedEmailSourceEvents,
  getNeedsReviewEmailSourceEvents,
} from "./source-event-queue-repository";

export type EmailAccountRow = typeof emailAccounts.$inferInsert;

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
