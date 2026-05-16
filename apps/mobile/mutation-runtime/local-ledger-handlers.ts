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
  const userId = command.processedSourceEventRow.userId;
  const processedSourceEventId = command.processedSourceEventRow.id;
  const reviewCandidateId = command.reviewCandidateRow.id;
  const evidenceIds = new Set(command.evidenceRows.map((row) => row.id));

  if (
    command.reviewCandidateRow.userId !== userId ||
    command.reviewCandidateRow.processedSourceEventId !== processedSourceEventId
  ) {
    throw new Error("Review candidate intake graph is inconsistent");
  }

  const hasInconsistentEvidence = command.evidenceRows.some(
    (row) => row.userId !== userId || row.processedSourceEventId !== processedSourceEventId
  );
  const hasInconsistentLink = command.evidenceLinkRows.some(
    (row) =>
      row.userId !== userId ||
      row.reviewCandidateId !== reviewCandidateId ||
      !evidenceIds.has(row.captureEvidenceId)
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
  if (persistedSourceEvent.id !== command.processedSourceEventRow.id) {
    return completeCommand(command.afterCommit);
  }
  updateReviewableSourceEvent(db, command, persistedSourceEvent);
  insertReviewCandidateGraph(db, command, persistedSourceEvent.id);

  return completeCommand(command.afterCommit);
};

function insertProcessedSourceEvent(db: ReviewCandidateDb, command: CreateReviewCandidateCommand) {
  db.insert(processedSourceEvents)
    .values(command.processedSourceEventRow)
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
        eq(processedSourceEvents.userId, command.processedSourceEventRow.userId),
        eq(processedSourceEvents.sourceFamily, command.processedSourceEventRow.sourceFamily),
        eq(processedSourceEvents.sourceId, command.processedSourceEventRow.sourceId),
        eq(processedSourceEvents.sourceEventId, command.processedSourceEventRow.sourceEventId),
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
      status: command.processedSourceEventRow.status,
      failureReason: command.processedSourceEventRow.failureReason,
      subject: command.processedSourceEventRow.subject,
      rawBodyPreview: command.processedSourceEventRow.rawBodyPreview,
      rawBody: command.processedSourceEventRow.rawBody,
      retryCount: command.processedSourceEventRow.retryCount,
      nextRetryAt: command.processedSourceEventRow.nextRetryAt,
      transactionId: command.processedSourceEventRow.transactionId,
      confidence: command.processedSourceEventRow.confidence,
      receivedAt: command.processedSourceEventRow.receivedAt,
      processedAt: command.processedSourceEventRow.processedAt,
      updatedAt: command.processedSourceEventRow.updatedAt,
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
  row: CreateReviewCandidateCommand["evidenceRows"][number],
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
      ...command.reviewCandidateRow,
      processedSourceEventId: normalizedSourceEventId,
    })
    .onConflictDoNothing()
    .run();
  command.evidenceRows.forEach((row) => {
    db.insert(captureEvidence)
      .values({ ...row, processedSourceEventId: normalizedSourceEventId })
      .onConflictDoNothing()
      .run();
  });
  const persistedEvidenceIds = new Map(
    command.evidenceRows.map((row) => [
      row.id,
      loadPersistedEvidenceId(db, row, normalizedSourceEventId),
    ])
  );
  command.evidenceLinkRows.forEach((row) => {
    db.insert(reviewCandidateCaptureEvidence)
      .values({
        ...row,
        captureEvidenceId: persistedEvidenceIds.get(row.captureEvidenceId) ?? row.captureEvidenceId,
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
