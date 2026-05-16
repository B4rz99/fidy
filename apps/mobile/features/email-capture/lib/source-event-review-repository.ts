import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type {
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

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
  const rows = selectFinancialMeaningSourceEventReviewRows(db)
    .where(
      and(
        eq(processedSourceEvents.id, input.processedSourceEventId),
        eq(processedSourceEvents.userId, input.userId),
        eq(reviewCandidates.id, input.reviewCandidateId),
        eq(reviewCandidates.userId, input.userId),
        eq(reviewCandidates.status, "pending"),
        isNull(processedSourceEvents.deletedAt),
        isNull(reviewCandidates.deletedAt)
      )
    )
    .limit(1)
    .all();
  return rows[0] ?? null;
}

const rejectPendingSiblingCandidates = (
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly updatedAt: IsoDateTime;
  }
) =>
  tx
    .update(reviewCandidates)
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

const markSourceEventReviewProcessed = (
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly transactionId: TransactionId;
    readonly updatedAt: IsoDateTime;
  }
) =>
  tx
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

const acceptPendingReviewCandidate = (
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly updatedAt: IsoDateTime;
  }
) =>
  tx
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
  return db.transaction((tx) => {
    const sourceEventUpdate = markSourceEventReviewProcessed(tx, input);
    if (sourceEventUpdate.changes !== 1) return false;

    const acceptedCandidateUpdate = acceptPendingReviewCandidate(tx, input);
    if (acceptedCandidateUpdate.changes !== 1) {
      throw new Error("Review candidate resolution target was not found");
    }

    rejectPendingSiblingCandidates(tx, input);
    return true;
  });
}

const rejectPendingReviewCandidate = (
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly updatedAt: IsoDateTime;
  }
) =>
  tx
    .update(reviewCandidates)
    .set({ status: "rejected", updatedAt: input.updatedAt })
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

const hasPendingSiblingCandidates = (
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
  }
) =>
  tx
    .select({ id: reviewCandidates.id })
    .from(reviewCandidates)
    .where(
      and(
        eq(reviewCandidates.processedSourceEventId, input.processedSourceEventId),
        eq(reviewCandidates.userId, input.userId),
        eq(reviewCandidates.status, "pending"),
        isNull(reviewCandidates.deletedAt)
      )
    )
    .limit(1)
    .all().length > 0;

const markSourceEventAfterReviewDismissal = (
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly hasPendingCandidates: boolean;
    readonly updatedAt: IsoDateTime;
  }
) =>
  tx
    .update(processedSourceEvents)
    .set({
      status: input.hasPendingCandidates ? "needs_review" : "dismissed",
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(processedSourceEvents.id, input.processedSourceEventId),
        eq(processedSourceEvents.userId, input.userId),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();

export function dismissSourceEventFinancialMeaningReviewById(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly updatedAt: IsoDateTime;
  }
) {
  db.transaction((tx) => {
    const rejectedCandidateUpdate = rejectPendingReviewCandidate(tx, input);
    if (rejectedCandidateUpdate.changes !== 1) return;

    const sourceEventUpdate = markSourceEventAfterReviewDismissal(tx, {
      ...input,
      hasPendingCandidates: hasPendingSiblingCandidates(tx, input),
    });
    if (sourceEventUpdate.changes !== 1) {
      throw new Error("Review source event was not active");
    }
  });
}
