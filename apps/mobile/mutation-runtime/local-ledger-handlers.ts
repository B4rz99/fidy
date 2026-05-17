/* eslint-disable no-restricted-imports */

import { and, eq, isNull, sql } from "drizzle-orm";
import {
  captureEvidence,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
} from "@/shared/db/schema";
import type { ProcessedSourceEventId } from "@/shared/types/branded";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand } from "./common";

type CreateReviewCandidateCommand = MutationCommandByKind<"localLedger.reviewCandidate.create">;
type ResolveReviewCandidateCommand = MutationCommandByKind<"localLedger.reviewCandidate.resolve">;
type ReviewCandidateDb = Parameters<
  MutationHandlerSubset<"localLedger.reviewCandidate.create">["localLedger.reviewCandidate.create"]
>[0];

function assertConsistentReviewCandidateGraph(command: CreateReviewCandidateCommand) {
  const userId = command.sourceEvent.userId;
  const processedSourceEventId = command.sourceEvent.id;
  const reviewCandidateId = command.candidate.id;
  const evidenceIds = new Set(command.evidence.map((row) => row.id));

  if (
    command.candidate.userId !== userId ||
    command.candidate.processedSourceEventId !== processedSourceEventId
  ) {
    throw new Error("Review candidate intake graph is inconsistent");
  }

  const hasInconsistentEvidence = command.evidence.some(
    (row) => row.userId !== userId || row.processedSourceEventId !== processedSourceEventId
  );
  const hasInconsistentLink = command.evidence.some(
    (row) => row.userId !== userId || !evidenceIds.has(row.id) || reviewCandidateId == null
  );

  if (hasInconsistentEvidence || hasInconsistentLink) {
    throw new Error("Review candidate intake graph is inconsistent");
  }
}

const applyCreateReviewCandidate = (
  db: ReviewCandidateDb,
  command: CreateReviewCandidateCommand
) => {
  assertConsistentReviewCandidateGraph(command);

  insertProcessedSourceEvent(db, command);
  const persistedSourceEvent = loadPersistedSourceEvent(db, command);
  if (persistedSourceEvent.id !== command.sourceEvent.id) {
    return completeCommand(command.afterCommit);
  }
  updateReviewableSourceEvent(db, command, persistedSourceEvent);
  insertReviewCandidateGraph(db, command, persistedSourceEvent.id);

  return completeCommand(command.afterCommit);
};

function insertProcessedSourceEvent(db: ReviewCandidateDb, command: CreateReviewCandidateCommand) {
  db.insert(processedSourceEvents)
    .values({ ...command.sourceEvent, deletedAt: null })
    .onConflictDoNothing({
      target: [
        processedSourceEvents.userId,
        processedSourceEvents.sourceFamily,
        processedSourceEvents.sourceId,
        processedSourceEvents.sourceEventId,
      ],
      where: sql`${processedSourceEvents.deletedAt} is null`,
    })
    .run();
}

function loadPersistedSourceEvent(db: ReviewCandidateDb, command: CreateReviewCandidateCommand) {
  const [persistedSourceEvent] = db
    .select({ id: processedSourceEvents.id, status: processedSourceEvents.status })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, command.sourceEvent.userId),
        eq(processedSourceEvents.sourceFamily, command.sourceEvent.sourceFamily),
        eq(processedSourceEvents.sourceId, command.sourceEvent.sourceId),
        eq(processedSourceEvents.sourceEventId, command.sourceEvent.sourceEventId),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .limit(1)
    .all();
  if (!persistedSourceEvent) {
    throw new Error("Review candidate source event was not persisted");
  }
  return {
    id: persistedSourceEvent.id as ProcessedSourceEventId,
    status: persistedSourceEvent.status,
  };
}

function updateReviewableSourceEvent(
  db: ReviewCandidateDb,
  command: CreateReviewCandidateCommand,
  persistedSourceEvent: ReturnType<typeof loadPersistedSourceEvent>
) {
  if (
    persistedSourceEvent.status !== "pending_retry" &&
    persistedSourceEvent.status !== "needs_review"
  ) {
    return;
  }

  db.update(processedSourceEvents)
    .set({
      status: command.sourceEvent.status,
      failureReason: command.sourceEvent.failureReason,
      retryCount: command.sourceEvent.retryCount,
      nextRetryAt: command.sourceEvent.nextRetryAt,
      transactionId: command.sourceEvent.transactionId,
      confidence: command.sourceEvent.confidence,
      receivedAt: command.sourceEvent.receivedAt,
      processedAt: command.sourceEvent.processedAt,
      updatedAt: command.sourceEvent.updatedAt,
    })
    .where(
      and(
        eq(processedSourceEvents.id, persistedSourceEvent.id),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();
}

function loadPersistedEvidenceId(
  db: ReviewCandidateDb,
  row: CreateReviewCandidateCommand["evidence"][number],
  processedSourceEventId: ProcessedSourceEventId
) {
  const [persistedEvidence] = db
    .select({ id: captureEvidence.id })
    .from(captureEvidence)
    .where(
      and(
        eq(captureEvidence.userId, row.userId),
        eq(captureEvidence.processedSourceEventId, processedSourceEventId),
        eq(captureEvidence.scope, row.scope),
        eq(captureEvidence.value, row.value),
        isNull(captureEvidence.deletedAt)
      )
    )
    .limit(1)
    .all();

  if (!persistedEvidence) {
    throw new Error("Review candidate evidence was not persisted");
  }

  return persistedEvidence.id;
}

function insertReviewCandidateGraph(
  db: ReviewCandidateDb,
  command: CreateReviewCandidateCommand,
  normalizedSourceEventId: ProcessedSourceEventId
) {
  db.insert(reviewCandidates)
    .values({
      ...command.candidate,
      processedSourceEventId: normalizedSourceEventId,
      deletedAt: null,
    })
    .onConflictDoNothing()
    .run();
  command.evidence.forEach((row) => {
    db.insert(captureEvidence)
      .values({
        ...row,
        transactionId: null,
        transferId: null,
        processedSourceEventId: normalizedSourceEventId,
        deletedAt: null,
      })
      .onConflictDoNothing()
      .run();
  });
  const persistedEvidenceIds = new Map(
    command.evidence.map((row) => [
      row.id,
      loadPersistedEvidenceId(db, row, normalizedSourceEventId),
    ])
  );
  command.evidence.forEach((row) => {
    db.insert(reviewCandidateCaptureEvidence)
      .values({
        id: row.linkId,
        userId: row.userId,
        reviewCandidateId: command.candidate.id,
        captureEvidenceId: persistedEvidenceIds.get(row.id) ?? row.id,
        createdAt: row.createdAt,
        deletedAt: null,
      })
      .onConflictDoNothing()
      .run();
  });
}

const applyResolveReviewCandidate = (
  db: Parameters<
    MutationHandlerSubset<"localLedger.reviewCandidate.resolve">["localLedger.reviewCandidate.resolve"]
  >[0],
  command: ResolveReviewCandidateCommand
) => {
  const candidateUpdate = db
    .update(reviewCandidates)
    .set({ status: command.reviewCandidateStatus, updatedAt: command.now })
    .where(
      and(
        eq(reviewCandidates.id, command.reviewCandidateId),
        eq(reviewCandidates.userId, command.userId),
        eq(reviewCandidates.processedSourceEventId, command.processedSourceEventId),
        eq(reviewCandidates.status, "pending"),
        isNull(reviewCandidates.deletedAt)
      )
    )
    .run();
  if (candidateUpdate.changes !== 1) {
    throw new Error("Review candidate resolution target was not found");
  }

  const sourceEventUpdate = db
    .update(processedSourceEvents)
    .set({ status: command.processedSourceEventStatus, updatedAt: command.now })
    .where(
      and(
        eq(processedSourceEvents.id, command.processedSourceEventId),
        eq(processedSourceEvents.userId, command.userId),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();
  if (sourceEventUpdate.changes !== 1) {
    throw new Error("Review candidate source event was not found");
  }

  return completeCommand(command.afterCommit);
};

export const localLedgerHandlers: MutationHandlerSubset<
  "localLedger.reviewCandidate.create" | "localLedger.reviewCandidate.resolve"
> = {
  "localLedger.reviewCandidate.create": applyCreateReviewCandidate,
  "localLedger.reviewCandidate.resolve": applyResolveReviewCandidate,
};
