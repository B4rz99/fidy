import type { LocalLedgerReviewCandidateId } from "@/local-ledger/public";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import { generateId } from "@/shared/lib/generate-id";
import type {
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  UserId,
} from "@/shared/types/branded";
import type { EmailReviewRow, ProcessedEmailRow } from "./repository";

type ProcessedSourceEventRow = typeof processedSourceEvents.$inferSelect;
type ProcessedSourceEventInsertRow = typeof processedSourceEvents.$inferInsert;

type PendingRetrySourceEventInput = {
  readonly userId: UserId;
  readonly row: ProcessedEmailRow;
};

type ReviewCandidateReadRow = {
  readonly candidateId: string;
  readonly sourceEventId: ProcessedSourceEventRow["id"];
  readonly sourceId: string;
  readonly externalId: string;
  readonly status: string;
  readonly failureReason: string | null;
  readonly receivedAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly confidence: number | null;
  readonly occurredAt: IsoDateTime | null;
  readonly amount: number | null;
  readonly description: string | null;
};

export const reviewCandidateEmailSelect = {
  candidateId: reviewCandidates.id,
  sourceEventId: processedSourceEvents.id,
  sourceId: processedSourceEvents.sourceId,
  externalId: processedSourceEvents.sourceEventId,
  status: processedSourceEvents.status,
  failureReason: processedSourceEvents.failureReason,
  receivedAt: processedSourceEvents.receivedAt,
  createdAt: reviewCandidates.createdAt,
  confidence: reviewCandidates.confidence,
  occurredAt: reviewCandidates.occurredAt,
  amount: reviewCandidates.amount,
  description: reviewCandidates.description,
};

const toEmailProvider = (sourceId: string) =>
  sourceId === "email_outlook" ? "outlook" : sourceId === "email_gmail" ? "gmail" : sourceId;

const toEmailSourceId = (provider: string) =>
  provider === "gmail" ? "email_gmail" : provider === "outlook" ? "email_outlook" : provider;

export const toProcessedEmailReadModel = (row: ProcessedSourceEventRow): ProcessedEmailRow => ({
  id: row.id as unknown as ProcessedEmailId,
  externalId: row.sourceEventId,
  provider: toEmailProvider(row.sourceId),
  status: row.status,
  failureReason: row.failureReason,
  subject: row.failureReason ?? row.sourceEventId,
  rawBodyPreview: null,
  receivedAt: row.receivedAt,
  transactionId: row.retryTransactionId,
  confidence: row.retryConfidence,
  createdAt: row.createdAt,
  rawBody: row.retryRawBody,
  retryCount: row.retryCount,
  nextRetryAt: row.nextRetryAt,
});

export const toPendingRetrySourceEventRow = (
  input: PendingRetrySourceEventInput
): ProcessedSourceEventInsertRow => ({
  id: generateId("pse") as ProcessedSourceEventId,
  userId: input.userId,
  sourceFamily: "email",
  sourceId: toEmailSourceId(input.row.provider),
  sourceEventId: input.row.externalId,
  status: "pending_retry",
  failureReason: input.row.failureReason,
  receivedAt: input.row.receivedAt,
  processedAt: input.row.createdAt,
  retryRawBody: input.row.rawBody ?? null,
  retryCount: input.row.retryCount ?? 0,
  nextRetryAt: input.row.nextRetryAt ?? null,
  retryTransactionId: null,
  retryConfidence: null,
  createdAt: input.row.createdAt,
  updatedAt: input.row.createdAt,
  deletedAt: null,
});

export const toReviewCandidateEmailReadModel = (row: ReviewCandidateReadRow): EmailReviewRow => ({
  id: row.candidateId as unknown as ProcessedEmailId,
  reviewCandidateId: row.candidateId as LocalLedgerReviewCandidateId,
  processedSourceEventId: row.sourceEventId,
  reviewCandidateOccurredAt: row.occurredAt,
  reviewCandidateAmount: row.amount,
  reviewCandidateDescription: row.description,
  externalId: row.externalId,
  provider: toEmailProvider(row.sourceId),
  status: row.status,
  failureReason: row.failureReason,
  subject: row.externalId,
  rawBodyPreview: null,
  receivedAt: row.receivedAt,
  transactionId: null,
  confidence: row.confidence,
  createdAt: row.createdAt,
  rawBody: null,
  retryCount: 0,
  nextRetryAt: null,
});
