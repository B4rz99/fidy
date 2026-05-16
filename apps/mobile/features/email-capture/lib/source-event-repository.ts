import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type {
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type ProcessedSourceEventRow = typeof processedSourceEvents.$inferInsert;
export type ReviewCandidateRow = typeof reviewCandidates.$inferSelect;
export type FinancialMeaningSourceEventReviewRow = {
  readonly processedSourceEvent: typeof processedSourceEvents.$inferSelect;
  readonly reviewCandidate: ReviewCandidateRow;
};

const selectFinancialMeaningSourceEventReviewRows = (db: AnyDb) =>
  db
    .select({
      processedSourceEvent: processedSourceEvents,
      reviewCandidate: reviewCandidates,
    })
    .from(processedSourceEvents)
    .innerJoin(
      reviewCandidates,
      eq(reviewCandidates.processedSourceEventId, processedSourceEvents.id)
    );

export async function getProcessedEmailSourceEventIds(
  db: AnyDb,
  userId: UserId,
  sourceEvents: readonly { readonly sourceId: string; readonly sourceEventId: string }[]
) {
  if (sourceEvents.length === 0) return new Set<string>();
  const sourceEventIds = sourceEvents.map((event) => event.sourceEventId);
  const requestedKeys = new Set(
    sourceEvents.map((event) => `${event.sourceId}:${event.sourceEventId}`)
  );
  const rows = await db
    .select({
      sourceId: processedSourceEvents.sourceId,
      sourceEventId: processedSourceEvents.sourceEventId,
    })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        inArray(processedSourceEvents.sourceEventId, sourceEventIds),
        isNull(processedSourceEvents.deletedAt)
      )
    );
  return new Set(
    rows
      .map((row) => `${row.sourceId}:${row.sourceEventId}`)
      .filter((key) => requestedKeys.has(key))
  );
}

export async function insertProcessedEmailSourceEvent(db: AnyDb, row: ProcessedSourceEventRow) {
  await db.insert(processedSourceEvents).values(row).onConflictDoNothing();
}

export async function getPendingRetryEmailSourceEvents(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "pending_retry"),
        lte(processedSourceEvents.nextRetryAt, sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .orderBy(asc(processedSourceEvents.nextRetryAt), asc(processedSourceEvents.receivedAt))
    .limit(50);
}

export async function getFinancialMeaningSourceEventReviewRows(
  db: AnyDb,
  userId: UserId
): Promise<readonly FinancialMeaningSourceEventReviewRow[]> {
  return selectFinancialMeaningSourceEventReviewRows(db).where(
    and(
      eq(processedSourceEvents.userId, userId),
      eq(reviewCandidates.userId, userId),
      eq(processedSourceEvents.sourceFamily, "email"),
      eq(processedSourceEvents.status, "needs_review"),
      eq(reviewCandidates.status, "pending"),
      isNull(processedSourceEvents.deletedAt),
      isNull(reviewCandidates.deletedAt)
    )
  );
}

export function getSourceEventReviewCandidateById(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
  }
): FinancialMeaningSourceEventReviewRow | null {
  const filters = [
    eq(processedSourceEvents.id, input.processedSourceEventId),
    eq(processedSourceEvents.userId, input.userId),
    eq(reviewCandidates.id, input.reviewCandidateId),
    eq(reviewCandidates.userId, input.userId),
    eq(reviewCandidates.status, "pending"),
    isNull(processedSourceEvents.deletedAt),
    isNull(reviewCandidates.deletedAt),
  ];
  const rows = selectFinancialMeaningSourceEventReviewRows(db)
    .where(and(...filters))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

export function acceptSourceEventFinancialMeaningReviewById(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly transactionId: TransactionId;
    readonly updatedAt: IsoDateTime;
  }
) {
  if (!markSourceEventReviewAccepted(db, input)) return false;
  assertReviewCandidateAccepted(db, input);
  return true;
}

function markSourceEventReviewAccepted(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly transactionId: TransactionId;
    readonly updatedAt: IsoDateTime;
  }
) {
  const update = db
    .update(processedSourceEvents)
    .set({ status: "processed", transactionId: input.transactionId, updatedAt: input.updatedAt })
    .where(
      and(
        eq(processedSourceEvents.id, input.processedSourceEventId),
        eq(processedSourceEvents.userId, input.userId),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();
  return update.changes === 1;
}

function assertReviewCandidateAccepted(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly updatedAt: IsoDateTime;
  }
) {
  const update = db
    .update(reviewCandidates)
    .set({ status: "accepted", updatedAt: input.updatedAt })
    .where(
      and(
        eq(reviewCandidates.id, input.reviewCandidateId),
        eq(reviewCandidates.processedSourceEventId, input.processedSourceEventId),
        eq(reviewCandidates.userId, input.userId),
        eq(reviewCandidates.status, "pending"),
        isNull(reviewCandidates.deletedAt)
      )
    )
    .run();
  if (update.changes !== 1) {
    throw new Error("Review candidate resolution target was not found");
  }
}

export function dismissSourceEventFinancialMeaningReviewById(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly updatedAt: IsoDateTime;
  }
) {
  db.transaction((tx) => {
    tx.update(processedSourceEvents)
      .set({ status: "dismissed", updatedAt: input.updatedAt })
      .where(
        and(
          eq(processedSourceEvents.id, input.processedSourceEventId),
          eq(processedSourceEvents.userId, input.userId),
          eq(processedSourceEvents.status, "needs_review"),
          isNull(processedSourceEvents.deletedAt)
        )
      )
      .run();
    tx.update(reviewCandidates)
      .set({ status: "rejected", updatedAt: input.updatedAt })
      .where(
        and(
          eq(reviewCandidates.processedSourceEventId, input.processedSourceEventId),
          eq(reviewCandidates.userId, input.userId),
          eq(reviewCandidates.status, "pending"),
          isNull(reviewCandidates.deletedAt)
        )
      )
      .run();
  });
}

function getProcessedSourceEventUpdateQuery(
  db: AnyDb,
  id: ProcessedSourceEventId,
  fields: Partial<ProcessedSourceEventRow>
) {
  return db.update(processedSourceEvents).set(fields).where(eq(processedSourceEvents.id, id));
}

export async function markSourceEventForRetry(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly retryCount: number;
  readonly nextRetryAt: IsoDateTime;
}) {
  await getProcessedSourceEventUpdateQuery(input.db, input.id, {
    status: "pending_retry",
    retryCount: input.retryCount,
    nextRetryAt: input.nextRetryAt,
  });
}

export async function markSourceEventPermanentlyFailed(db: AnyDb, id: ProcessedSourceEventId) {
  await getProcessedSourceEventUpdateQuery(db, id, { status: "failed", rawBody: null });
}

export async function markSourceEventRetrySuccess(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly status: "processed" | "needs_review" | "duplicate";
  readonly transactionId: TransactionId | null;
  readonly confidence: number;
}) {
  await getProcessedSourceEventUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
    confidence: input.confidence,
    rawBody: null,
  });
}

export async function updateProcessedSourceEventStatus(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
  readonly rawBody?: string | null;
}) {
  const rawBodyFields = input.rawBody === undefined ? {} : { rawBody: input.rawBody };
  await getProcessedSourceEventUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
    ...rawBodyFields,
  });
}
