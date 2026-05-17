import { and, eq, isNull } from "drizzle-orm";
import {
  createReviewCandidateUseCase,
  type CreateReviewCandidateCommand,
  type CreateReviewCandidateInput,
} from "@/local-ledger/intake.public";
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
  generateId,
  generateProcessedSourceEventId,
  generateReviewCandidateCaptureEvidenceId,
  generateReviewCandidateId,
} from "@/shared/lib/generate-id";
import type {
  CaptureEvidenceId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateCaptureEvidenceId,
  ReviewCandidateId,
  UserId,
} from "@/shared/types/branded";

type PersistReviewCandidateInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly sourceFamily: string;
  readonly sourceId: string;
  readonly sourceEventId: string;
  readonly status: "needs_review";
  readonly failureReason: string | null;
  readonly receivedAt: IsoDateTime;
  readonly processedAt: IsoDateTime;
  readonly candidate: {
    readonly occurredAt: IsoDate | null;
    readonly amount: CopAmount | null;
    readonly transactionType?: "expense" | "income" | null;
    readonly categoryId?: CategoryId | null;
    readonly description: string | null;
    readonly confidence: number | null;
  };
  readonly evidence: readonly CaptureEvidenceSeed[];
};

const isKnownSourceEventStatus = (status: string) =>
  status === "processed" ||
  status === "needs_review" ||
  status === "failed" ||
  status === "duplicate" ||
  status === "dismissed" ||
  status === "pending_retry";

const findReviewSourceEvent = (
  db: AnyDb,
  input: Pick<
    CreateReviewCandidateCommand["sourceEvent"],
    "userId" | "sourceFamily" | "sourceId" | "sourceEventId"
  >
) => {
  const row = db
    .select({ id: processedSourceEvents.id, status: processedSourceEvents.status })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, input.userId as UserId),
        eq(processedSourceEvents.sourceFamily, input.sourceFamily),
        eq(processedSourceEvents.sourceId, input.sourceId),
        eq(processedSourceEvents.sourceEventId, input.sourceEventId),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .limit(1)
    .all()[0];

  if (!row) return null;
  if (!isKnownSourceEventStatus(row.status)) {
    throw new Error(`Unknown processed source event status: ${row.status}`);
  }
  return { id: row.id, status: row.status };
};

const updateFailedSourceEventForReview = (
  db: AnyDb,
  input: CreateReviewCandidateCommand["sourceEvent"],
  id: ProcessedSourceEventId
) => {
  db.update(processedSourceEvents)
    .set({
      status: input.status,
      failureReason: input.failureReason,
      retryCount: input.retryCount ?? 0,
      nextRetryAt: (input.nextRetryAt ?? null) as IsoDateTime | null,
      transactionId: null,
      confidence: input.confidence ?? null,
      receivedAt: input.receivedAt as IsoDateTime,
      processedAt: input.processedAt as IsoDateTime,
      updatedAt: input.updatedAt as IsoDateTime,
    })
    .where(eq(processedSourceEvents.id, id))
    .run();
};

const canTransitionSourceEventToReview = (status: string) =>
  status === "failed" || status === "pending_retry";

const insertReviewSourceEvent = (
  db: AnyDb,
  input: CreateReviewCandidateCommand["sourceEvent"],
  id: ProcessedSourceEventId
) => {
  db.insert(processedSourceEvents)
    .values({
      id,
      userId: input.userId as UserId,
      sourceFamily: input.sourceFamily,
      sourceId: input.sourceId,
      sourceEventId: input.sourceEventId,
      status: input.status,
      failureReason: input.failureReason,
      retryCount: input.retryCount ?? 0,
      nextRetryAt: (input.nextRetryAt ?? null) as IsoDateTime | null,
      transactionId: null,
      confidence: input.confidence ?? null,
      receivedAt: input.receivedAt as IsoDateTime,
      processedAt: input.processedAt as IsoDateTime,
      createdAt: input.createdAt as IsoDateTime,
      updatedAt: input.updatedAt as IsoDateTime,
      deletedAt: null,
    })
    .onConflictDoNothing()
    .run();

  return findReviewSourceEvent(db, input);
};

const upsertReviewSourceEvent = (
  db: AnyDb,
  command: CreateReviewCandidateCommand
): ProcessedSourceEventId | null => {
  const existing = findReviewSourceEvent(db, command.sourceEvent);
  if (existing !== null && !canTransitionSourceEventToReview(existing.status)) return null;

  const sourceEventId = (existing?.id ?? command.sourceEvent.id) as ProcessedSourceEventId;
  if (existing !== null) {
    updateFailedSourceEventForReview(db, command.sourceEvent, sourceEventId);
  } else {
    const persisted = insertReviewSourceEvent(db, command.sourceEvent, sourceEventId);
    if (persisted?.id !== sourceEventId) return null;
  }

  return sourceEventId;
};

const insertReviewCandidate = (
  db: AnyDb,
  command: CreateReviewCandidateCommand,
  sourceEventId: ProcessedSourceEventId
) => {
  db.insert(reviewCandidates)
    .values({
      id: command.candidate.id as ReviewCandidateId,
      userId: command.candidate.userId as UserId,
      processedSourceEventId: sourceEventId,
      status: command.candidate.status,
      candidateKind: command.candidate.candidateKind,
      occurredAt: command.candidate.occurredAt as IsoDate | null,
      amount: command.candidate.amount as CopAmount | null,
      currency: command.candidate.currency,
      transactionType: command.candidate.transactionType ?? null,
      categoryId: (command.candidate.categoryId ?? null) as CategoryId | null,
      description: command.candidate.description,
      confidence: command.candidate.confidence,
      createdAt: command.candidate.createdAt as IsoDateTime,
      updatedAt: command.candidate.updatedAt as IsoDateTime,
      deletedAt: null,
    })
    .run();
};

const insertReviewEvidence = (
  db: AnyDb,
  command: CreateReviewCandidateCommand,
  sourceEventId: ProcessedSourceEventId
) => {
  command.evidence.forEach((row) => {
    db.insert(captureEvidence)
      .values({
        id: row.id as CaptureEvidenceId,
        userId: row.userId as UserId,
        sourceFamily: row.sourceFamily,
        evidenceType: row.evidenceType,
        scope: row.scope,
        value: row.value,
        transactionId: null,
        transferId: null,
        processedSourceEventId: sourceEventId,
        createdAt: row.createdAt as IsoDateTime,
        updatedAt: row.updatedAt as IsoDateTime,
        deletedAt: null,
      })
      .run();
    db.insert(reviewCandidateCaptureEvidence)
      .values({
        id: row.linkId as ReviewCandidateCaptureEvidenceId,
        userId: row.userId as UserId,
        reviewCandidateId: command.candidate.id as ReviewCandidateId,
        captureEvidenceId: row.id as CaptureEvidenceId,
        createdAt: row.createdAt as IsoDateTime,
        deletedAt: null,
      })
      .run();
  });
};

const commitReviewCandidateCommand = (
  db: AnyDb,
  command: CreateReviewCandidateCommand
): { readonly success: true; readonly didMutate?: boolean } => {
  db.transaction((tx) => {
    const sourceEventId = upsertReviewSourceEvent(tx, command);
    if (sourceEventId === null) return;

    insertReviewCandidate(tx, command, sourceEventId);
    insertReviewEvidence(tx, command, sourceEventId);
  });

  return { success: true, didMutate: true };
};

const toReviewCandidateInput = (input: PersistReviewCandidateInput): CreateReviewCandidateInput => {
  type IntakeSourceEventId = CreateReviewCandidateInput["source"]["processedSourceEventId"];
  const processedSourceEventId = generateProcessedSourceEventId() as unknown as IntakeSourceEventId;

  return {
    commandId: generateId("llc") as CreateReviewCandidateInput["commandId"],
    userId: input.userId,
    source: {
      processedSourceEventId,
      sourceFamily: input.sourceFamily,
      sourceId: input.sourceId as CreateReviewCandidateInput["source"]["sourceId"],
      sourceEventId: input.sourceEventId,
      receivedAt: input.receivedAt,
      processedAt: input.processedAt,
      status: input.status,
      failureReason: input.failureReason,
      retryCount: 0,
      nextRetryAt: null,
      transactionId: null,
      confidence: input.candidate.confidence,
    },
    candidate: {
      id: generateReviewCandidateId(),
      candidateKind: "transaction",
      status: "pending",
      occurredAt: input.candidate.occurredAt,
      money:
        input.candidate.amount === null
          ? null
          : { amount: input.candidate.amount, currency: "COP" },
      transactionType: input.candidate.transactionType ?? null,
      categoryId: input.candidate.categoryId ?? null,
      description: input.candidate.description,
      confidence: input.candidate.confidence,
    },
    evidence: input.evidence.map((row) => ({
      id: generateCaptureEvidenceId(),
      linkId: generateReviewCandidateCaptureEvidenceId(),
      sourceFamily: row.sourceFamily,
      evidenceType: row.evidenceType,
      scope: row.scope,
      value: row.value,
    })),
    now: input.processedAt,
  };
};

export const recordReviewCandidateCaptureWithLocalLedger = async (
  input: PersistReviewCandidateInput
) => {
  if (input.status !== "needs_review") {
    throw new Error("Review candidate captures must use needs_review source-event status");
  }

  const createReviewCandidate = createReviewCandidateUseCase({
    commit: (command) => Promise.resolve(commitReviewCandidateCommand(input.db, command)),
  });
  return createReviewCandidate(toReviewCandidateInput(input));
};
