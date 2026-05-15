/* eslint-disable no-restricted-imports */

import { and, eq, isNull } from "drizzle-orm";
import {
  captureEvidence,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
} from "@/shared/db/schema";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand } from "./common";

type CreateReviewCandidateCommand = MutationCommandByKind<"localLedger.reviewCandidate.create">;
type ResolveReviewCandidateCommand = MutationCommandByKind<"localLedger.reviewCandidate.resolve">;

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
  db: Parameters<
    MutationHandlerSubset<"localLedger.reviewCandidate.create">["localLedger.reviewCandidate.create"]
  >[0],
  command: CreateReviewCandidateCommand
) => {
  assertConsistentReviewCandidateGraph(command);

  db.insert(processedSourceEvents).values(command.processedSourceEventRow).run();
  db.insert(reviewCandidates).values(command.reviewCandidateRow).run();
  command.evidenceRows.forEach((row) => {
    db.insert(captureEvidence).values(row).run();
  });
  command.evidenceLinkRows.forEach((row) => {
    db.insert(reviewCandidateCaptureEvidence).values(row).run();
  });

  return completeCommand(command.afterCommit);
};

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
