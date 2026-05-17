import { and, eq, isNull, lt } from "drizzle-orm";
import type { LocalLedgerTransfer } from "@/local-ledger/public";
import type { AnyDb } from "@/shared/db";
import { captureEvidence, processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type {
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { saveTransferStorageRow, toTransferRow } from "./record-transfer";
import {
  getReclassificationTransactionById,
  markReclassificationTransactionSuperseded,
} from "./transfer-reclassification-transactions";

export type ReclassifyTransactionAsTransferInput = {
  readonly userId: UserId;
  readonly transactionId: TransactionId;
  readonly processedSourceEventId?: ProcessedSourceEventId;
  readonly reviewCandidateId?: ReviewCandidateId;
  readonly transfer: LocalLedgerTransfer;
  readonly updatedAt: IsoDateTime;
};

type ReclassifyTransactionAsTransferDeps = {
  readonly saveTransferRow?: typeof saveTransferStorageRow;
  readonly loadTransactionById?: typeof getReclassificationTransactionById;
  readonly saveTransactionRow?: typeof markReclassificationTransactionSuperseded;
  readonly relinkEvidenceToTransfer?: typeof relinkReclassificationCaptureEvidenceToTransfer;
  readonly saveProcessedSourceEventStatus?: typeof markSourceEventReviewCandidateReclassifiedAsTransfer;
};

type ReclassificationTransaction = NonNullable<
  ReturnType<typeof getReclassificationTransactionById>
>;
type ResolvedReclassificationDeps = {
  readonly saveTransferRow: typeof saveTransferStorageRow;
  readonly loadTransactionById: typeof getReclassificationTransactionById;
  readonly saveTransactionRow: typeof markReclassificationTransactionSuperseded;
  readonly relinkEvidenceToTransfer: typeof relinkReclassificationCaptureEvidenceToTransfer;
  readonly saveProcessedSourceEventStatus: typeof markSourceEventReviewCandidateReclassifiedAsTransfer;
};

const DEFAULT_RECLASSIFICATION_DEPS: ResolvedReclassificationDeps = {
  saveTransferRow: saveTransferStorageRow,
  loadTransactionById: getReclassificationTransactionById,
  saveTransactionRow: markReclassificationTransactionSuperseded,
  relinkEvidenceToTransfer: relinkReclassificationCaptureEvidenceToTransfer,
  saveProcessedSourceEventStatus: markSourceEventReviewCandidateReclassifiedAsTransfer,
};

const resolveReclassificationDeps = (
  deps: ReclassifyTransactionAsTransferDeps
): ResolvedReclassificationDeps => ({ ...DEFAULT_RECLASSIFICATION_DEPS, ...deps });

export type ReclassifyTransactionAsTransferError =
  | "reviewCandidateRequired"
  | "transactionNotFound";

export type ReclassifyTransactionAsTransferResult =
  | { success: true; transfer: LocalLedgerTransfer }
  | { success: false; error: ReclassifyTransactionAsTransferError };

function relinkReclassificationCaptureEvidenceToTransfer(
  db: AnyDb,
  input: {
    readonly transactionId: TransactionId;
    readonly transferId: LocalLedgerTransfer["id"];
    readonly updatedAt: IsoDateTime;
  }
) {
  db.update(captureEvidence)
    .set({ transactionId: null, transferId: input.transferId, updatedAt: input.updatedAt })
    .where(
      and(
        eq(captureEvidence.transactionId, input.transactionId),
        isNull(captureEvidence.deletedAt),
        lt(captureEvidence.updatedAt, input.updatedAt)
      )
    )
    .run();
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

function markSourceEventReviewCandidateReclassifiedAsTransfer(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly transactionId: TransactionId;
    readonly updatedAt: IsoDateTime;
  }
) {
  const sourceEventUpdate = db
    .update(processedSourceEvents)
    .set({ status: "processed", transactionId: input.transactionId, updatedAt: input.updatedAt })
    .where(
      and(
        eq(processedSourceEvents.id, input.processedSourceEventId),
        eq(processedSourceEvents.userId, input.userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();
  if (sourceEventUpdate.changes !== 1) {
    throw new Error("Review source event was not active");
  }

  const rejectedCandidateUpdate = db
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
  if (rejectedCandidateUpdate.changes !== 1) {
    throw new Error("Review candidate resolution target was not found");
  }

  rejectPendingSiblingCandidates(db, input);
}

const isActiveReclassificationTransaction = (
  transaction: ReclassificationTransaction | null,
  userId: UserId
): transaction is ReclassificationTransaction =>
  transaction != null &&
  transaction.userId === userId &&
  transaction.voidedAt == null &&
  transaction.supersededAt == null;

const hasIncompleteReviewLink = (input: ReclassifyTransactionAsTransferInput): boolean =>
  (input.processedSourceEventId == null) !== (input.reviewCandidateId == null);

const transferBelongsToUser = (input: ReclassifyTransactionAsTransferInput): boolean =>
  input.transfer.userId === input.userId;

function persistSingleReclassification(
  tx: AnyDb,
  input: ReclassifyTransactionAsTransferInput,
  existingTransaction: ReclassificationTransaction,
  deps: ResolvedReclassificationDeps
) {
  deps.saveTransferRow(tx, toTransferRow(input.transfer));
  deps.saveTransactionRow(tx, {
    ...existingTransaction,
    supersededAt: input.updatedAt,
    supersededByTransferId: input.transfer.id,
    updatedAt: input.updatedAt,
  });
  deps.relinkEvidenceToTransfer(tx, {
    transactionId: existingTransaction.id,
    transferId: input.transfer.id,
    updatedAt: input.updatedAt,
  });
  if (input.processedSourceEventId == null || input.reviewCandidateId == null) return;

  deps.saveProcessedSourceEventStatus(tx, {
    processedSourceEventId: input.processedSourceEventId,
    userId: input.userId,
    reviewCandidateId: input.reviewCandidateId,
    transactionId: existingTransaction.id,
    updatedAt: input.updatedAt,
  });
}

export function reclassifyTransactionAsTransfer(
  db: AnyDb,
  input: ReclassifyTransactionAsTransferInput,
  deps: ReclassifyTransactionAsTransferDeps = {}
): ReclassifyTransactionAsTransferResult {
  const resolvedDeps = resolveReclassificationDeps(deps);
  const existingTransaction = resolvedDeps.loadTransactionById(db, input.transactionId);

  if (!isActiveReclassificationTransaction(existingTransaction, input.userId)) {
    return { success: false, error: "transactionNotFound" };
  }
  if (hasIncompleteReviewLink(input)) {
    return { success: false, error: "reviewCandidateRequired" };
  }
  if (!transferBelongsToUser(input)) {
    return { success: false, error: "transactionNotFound" };
  }

  db.transaction((tx) => {
    persistSingleReclassification(tx, input, existingTransaction, resolvedDeps);
  });

  return { success: true, transfer: input.transfer };
}
