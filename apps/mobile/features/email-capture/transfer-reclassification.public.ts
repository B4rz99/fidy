import type { AnyDb } from "@/shared/db";
import type {
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  markSourceEventReviewCandidateReclassifiedAsTransfer,
  updateProcessedEmailStatusInTransaction,
} from "./lib/repository";

export function markProcessedEmailReclassifiedAsTransfer(input: {
  readonly db: AnyDb;
  readonly id: ProcessedEmailId;
  readonly transactionId: TransactionId;
}) {
  updateProcessedEmailStatusInTransaction({
    db: input.db,
    id: input.id,
    status: "success",
    transactionId: input.transactionId,
  });
}

export function markProcessedSourceEventReclassifiedAsTransfer(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly userId: UserId;
  readonly reviewCandidateId: ReviewCandidateId;
  readonly transactionId: TransactionId;
  readonly updatedAt: IsoDateTime;
}) {
  markSourceEventReviewCandidateReclassifiedAsTransfer(input.db, {
    processedSourceEventId: input.id,
    userId: input.userId,
    reviewCandidateId: input.reviewCandidateId,
    transactionId: input.transactionId,
    updatedAt: input.updatedAt,
  });
}
