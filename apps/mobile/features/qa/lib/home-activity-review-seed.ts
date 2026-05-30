import type { ProcessedSourceEventRow } from "@/features/email-capture/public";
import type { TransactionRow } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db";
import { captureEvidence, processedSourceEvents } from "@/shared/db/schema";
import { toIsoDateTime } from "@/shared/lib";
import {
  generateCaptureEvidenceId,
  generateProcessedSourceEventId,
} from "@/shared/lib/generate-id";
import type { UserId } from "@/shared/types/branded";

const QA_BANCOLOMBIA_SCOPE = "account_alias";
const QA_BANCOLOMBIA_VALUE = "Bancolombia";

export function buildQaNeedsReviewEmailSourceEvents(input: {
  readonly userId: UserId;
  readonly now: Date;
}): readonly ProcessedSourceEventRow[] {
  const createdAt = toIsoDateTime(input.now);

  return [
    {
      id: generateProcessedSourceEventId(),
      userId: input.userId,
      sourceFamily: "email",
      sourceId: "qa-email:fidy.dev",
      sourceEventId: "qa-needs-review-1",
      status: "needs_review",
      failureReason: null,
      receivedAt: createdAt,
      processedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      transactionId: null,
      confidence: 0.54,
    },
  ];
}

export function seedHomeActivityAttributionReviewRows(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly transactions: readonly TransactionRow[];
  readonly now: Date;
}): void {
  const unresolvedTransaction = input.transactions.find(
    (transaction) => transaction.accountAttributionState === "unresolved"
  );
  const confirmedTransaction = input.transactions.find(
    (transaction) => transaction.accountAttributionState === "confirmed"
  );

  if (!unresolvedTransaction || !confirmedTransaction) return;

  const createdAt = toIsoDateTime(input.now);
  const unresolvedSourceEventId = generateProcessedSourceEventId();
  const confirmedSourceEventId = generateProcessedSourceEventId();

  const sourceEvents = [
    {
      id: unresolvedSourceEventId,
      userId: input.userId,
      sourceFamily: "notification",
      sourceId: "qa-bancolombia",
      sourceEventId: "qa-bancolombia-unresolved",
      status: "processed",
      failureReason: null,
      receivedAt: createdAt,
      processedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      transactionId: unresolvedTransaction.id,
      confidence: 0.92,
    },
    {
      id: confirmedSourceEventId,
      userId: input.userId,
      sourceFamily: "notification",
      sourceId: "qa-bancolombia",
      sourceEventId: "qa-bancolombia-confirmed",
      status: "processed",
      failureReason: null,
      receivedAt: createdAt,
      processedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      transactionId: confirmedTransaction.id,
      confidence: 0.92,
    },
  ] satisfies readonly ProcessedSourceEventRow[];

  const evidenceRows = [
    {
      id: generateCaptureEvidenceId(),
      userId: input.userId,
      sourceFamily: "bancolombia",
      evidenceType: "alias_token",
      scope: QA_BANCOLOMBIA_SCOPE,
      value: QA_BANCOLOMBIA_VALUE,
      transactionId: unresolvedTransaction.id,
      transferId: null,
      processedSourceEventId: unresolvedSourceEventId,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
    {
      id: generateCaptureEvidenceId(),
      userId: input.userId,
      sourceFamily: "bancolombia",
      evidenceType: "alias_token",
      scope: QA_BANCOLOMBIA_SCOPE,
      value: QA_BANCOLOMBIA_VALUE,
      transactionId: confirmedTransaction.id,
      transferId: null,
      processedSourceEventId: confirmedSourceEventId,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
  ];

  input.db.insert(processedSourceEvents).values(sourceEvents).onConflictDoNothing().run();
  input.db.insert(captureEvidence).values(evidenceRows).onConflictDoNothing().run();
}
