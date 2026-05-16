import { and, eq, isNull } from "drizzle-orm";
import type { CaptureEvidenceSeed } from "@/shared/capture-evidence/types";
import type { AnyDb } from "@/shared/db";
import {
  captureEvidence,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
} from "@/shared/db/schema";
import {
  generateCaptureEvidenceId,
  generateProcessedSourceEventId,
  generateReviewCandidateCaptureEvidenceId,
  generateReviewCandidateId,
} from "@/shared/lib/generate-id";
import type {
  CaptureEvidenceId,
  CopAmount,
  IsoDateTime,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

type SourceEventStatus = "processed" | "needs_review" | "failed";

type SourceEventInput = {
  readonly userId: UserId;
  readonly sourceFamily: string;
  readonly sourceId: string;
  readonly sourceEventId: string;
  readonly status: SourceEventStatus;
  readonly failureReason: string | null;
  readonly receivedAt: IsoDateTime;
  readonly processedAt: IsoDateTime;
};

type PersistSourceEventInput = SourceEventInput & {
  readonly db: AnyDb;
};

type PersistReviewCandidateInput = Omit<PersistSourceEventInput, "status"> & {
  readonly status: "needs_review";
  readonly candidate: {
    readonly occurredAt: IsoDateTime | null;
    readonly amount: CopAmount | null;
    readonly description: string | null;
    readonly confidence: number | null;
  };
  readonly evidence: readonly CaptureEvidenceSeed[];
};

type PersistCommittedCaptureInput = PersistSourceEventInput & {
  readonly transactionId: TransactionId;
  readonly evidence: readonly CaptureEvidenceSeed[];
};

const isSourceEventStatus = (status: string): status is SourceEventStatus =>
  status === "processed" || status === "needs_review" || status === "failed";

const findSourceEvent = (
  db: AnyDb,
  input: Pick<SourceEventInput, "userId" | "sourceFamily" | "sourceId" | "sourceEventId">
) => {
  const rows = db
    .select({ id: processedSourceEvents.id, status: processedSourceEvents.status })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, input.userId),
        eq(processedSourceEvents.sourceFamily, input.sourceFamily),
        eq(processedSourceEvents.sourceId, input.sourceId),
        eq(processedSourceEvents.sourceEventId, input.sourceEventId),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .limit(1)
    .all();

  const row = rows[0];
  if (!row) return null;
  if (!isSourceEventStatus(row.status)) {
    throw new Error(`Unknown processed source event status: ${row.status}`);
  }
  return { id: row.id, status: row.status };
};

const updateFailedSourceEvent = (
  db: AnyDb,
  input: SourceEventInput,
  id: ProcessedSourceEventId
) => {
  db.update(processedSourceEvents)
    .set({
      status: input.status,
      failureReason: input.failureReason,
      receivedAt: input.receivedAt,
      processedAt: input.processedAt,
      updatedAt: input.processedAt,
    })
    .where(eq(processedSourceEvents.id, id))
    .run();
};

const insertSourceEvent = (
  db: AnyDb,
  input: SourceEventInput,
  id: ProcessedSourceEventId = generateProcessedSourceEventId()
) => {
  const existing = findSourceEvent(db, input);
  if (existing !== null) {
    if (existing.status === "failed" && input.status !== "failed") {
      updateFailedSourceEvent(db, input, existing.id);
      return { id: existing.id, inserted: true };
    }

    return { id: existing.id, inserted: false };
  }

  db.insert(processedSourceEvents)
    .values({
      id,
      userId: input.userId,
      sourceFamily: input.sourceFamily,
      sourceId: input.sourceId,
      sourceEventId: input.sourceEventId,
      status: input.status,
      failureReason: input.failureReason,
      receivedAt: input.receivedAt,
      processedAt: input.processedAt,
      createdAt: input.processedAt,
      updatedAt: input.processedAt,
      deletedAt: null,
    })
    .onConflictDoNothing()
    .run();

  const persisted = findSourceEvent(db, input);
  return { id: persisted?.id ?? id, inserted: persisted?.id === id };
};

const insertCaptureEvidence = (
  db: AnyDb,
  input: SourceEventInput & {
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly transactionId: TransactionId | null;
    readonly evidence: readonly CaptureEvidenceSeed[];
  }
) =>
  input.evidence.map((row) => {
    const id = generateCaptureEvidenceId();
    db.insert(captureEvidence)
      .values({
        id,
        userId: input.userId,
        sourceFamily: row.sourceFamily,
        evidenceType: row.evidenceType,
        scope: row.scope,
        value: row.value,
        transactionId: input.transactionId,
        transferId: null,
        processedEmailId: null,
        processedCaptureId: null,
        processedSourceEventId: input.processedSourceEventId,
        createdAt: input.processedAt,
        updatedAt: input.processedAt,
        deletedAt: null,
      })
      .run();
    return id;
  });

export const persistProcessedSourceEvent = (input: PersistSourceEventInput) => {
  insertSourceEvent(input.db, input);
};

export const persistCommittedCaptureSourceEventInTransaction = (
  db: AnyDb,
  input: Omit<PersistCommittedCaptureInput, "db">
) => {
  const sourceEvent = insertSourceEvent(db, input);
  if (!sourceEvent.inserted) return;

  insertCaptureEvidence(db, {
    ...input,
    processedSourceEventId: sourceEvent.id,
    transactionId: input.transactionId,
  });
};

export const persistCommittedCaptureSourceEvent = (
  db: AnyDb,
  input: Omit<PersistCommittedCaptureInput, "db">
) => {
  db.transaction((tx) => {
    persistCommittedCaptureSourceEventInTransaction(tx, input);
  });
};

export const persistReviewCandidateCapture = (input: PersistReviewCandidateInput) => {
  if (input.status !== "needs_review") {
    throw new Error("Review candidate captures must use needs_review source-event status");
  }

  input.db.transaction((tx) => {
    const sourceEvent = insertSourceEvent(tx, input);
    if (!sourceEvent.inserted) return;

    const reviewCandidateId = generateReviewCandidateId();
    tx.insert(reviewCandidates)
      .values({
        id: reviewCandidateId,
        userId: input.userId,
        processedSourceEventId: sourceEvent.id,
        status: "pending",
        candidateKind: "transaction",
        occurredAt: input.candidate.occurredAt,
        amount: input.candidate.amount,
        currency: "COP",
        description: input.candidate.description,
        confidence: input.candidate.confidence,
        createdAt: input.processedAt,
        updatedAt: input.processedAt,
        deletedAt: null,
      })
      .run();

    const evidenceIds = insertCaptureEvidence(tx, {
      ...input,
      processedSourceEventId: sourceEvent.id,
      transactionId: null,
    });
    evidenceIds.forEach((captureEvidenceId: CaptureEvidenceId) => {
      tx.insert(reviewCandidateCaptureEvidence)
        .values({
          id: generateReviewCandidateCaptureEvidenceId(),
          userId: input.userId,
          reviewCandidateId,
          captureEvidenceId,
          createdAt: input.processedAt,
          deletedAt: null,
        })
        .run();
    });
  });
};
