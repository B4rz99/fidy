import type {
  LocalLedgerCaptureEvidence,
  LocalLedgerCommandId,
  LocalLedgerProcessedSourceEventId,
  LocalLedgerProcessedSourceEventStatus,
  LocalLedgerReviewCandidate,
  LocalLedgerSourceId,
} from "../domain/public";
import type {
  CaptureEvidenceId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateCaptureEvidenceId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type IntakeLocalLedgerCandidate = {
  readonly commandId: LocalLedgerCommandId;
  readonly sourceId: LocalLedgerSourceId;
  readonly receivedAt: string;
  readonly rawText: string;
};

export type IntakeLocalLedgerCandidateResult = {
  readonly accepted: boolean;
  readonly reason: string | null;
};

export type IntakeLocalLedgerCandidateHandler = (
  candidate: IntakeLocalLedgerCandidate
) => Promise<IntakeLocalLedgerCandidateResult>;

export type CreateReviewCandidateCommand = {
  readonly kind: "localLedger.reviewCandidate.create";
  readonly sourceEvent: {
    readonly id: ProcessedSourceEventId;
    readonly userId: UserId;
    readonly sourceFamily: string;
    readonly sourceId: string;
    readonly sourceEventId: string;
    readonly status: LocalLedgerProcessedSourceEventStatus;
    readonly failureReason: string | null;
    readonly retryCount?: number;
    readonly nextRetryAt?: IsoDateTime | null;
    readonly transactionId?: TransactionId | null;
    readonly confidence?: number | null;
    readonly receivedAt: IsoDateTime;
    readonly processedAt: IsoDateTime;
    readonly createdAt: IsoDateTime;
    readonly updatedAt: IsoDateTime;
  };
  readonly candidate: {
    readonly id: ReviewCandidateId;
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly status: LocalLedgerReviewCandidate["status"];
    readonly candidateKind: LocalLedgerReviewCandidate["candidateKind"];
    readonly occurredAt: IsoDate | null;
    readonly amount: CopAmount | null;
    readonly currency: "COP";
    readonly transactionType?: "expense" | "income" | null;
    readonly categoryId?: CategoryId | null;
    readonly description: string | null;
    readonly confidence: number | null;
    readonly createdAt: IsoDateTime;
    readonly updatedAt: IsoDateTime;
  };
  readonly evidence: readonly {
    readonly id: CaptureEvidenceId;
    readonly linkId: ReviewCandidateCaptureEvidenceId;
    readonly userId: UserId;
    readonly sourceFamily: string;
    readonly evidenceType: string;
    readonly scope: string;
    readonly value: string;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly createdAt: IsoDateTime;
    readonly updatedAt: IsoDateTime;
  }[];
};

export type CreateReviewCandidateInput = {
  readonly commandId: LocalLedgerCommandId;
  readonly userId: UserId;
  readonly source: {
    readonly processedSourceEventId: LocalLedgerProcessedSourceEventId;
    readonly sourceFamily: string;
    readonly sourceId: LocalLedgerSourceId;
    readonly sourceEventId: string;
    readonly receivedAt: IsoDateTime;
    readonly processedAt: IsoDateTime;
    readonly status: LocalLedgerProcessedSourceEventStatus;
    readonly failureReason: string | null;
    readonly retryCount?: number;
    readonly nextRetryAt?: IsoDateTime | null;
    readonly transactionId?: TransactionId | null;
    readonly confidence?: number | null;
  };
  readonly candidate: LocalLedgerReviewCandidate;
  readonly evidence: readonly LocalLedgerCaptureEvidence[];
  readonly now: IsoDateTime;
};

export type CreateReviewCandidateCommitPort = {
  readonly commit: (
    command: CreateReviewCandidateCommand
  ) => Promise<
    | { readonly success: true; readonly didMutate?: boolean }
    | { readonly success: false; readonly error: string }
  >;
};

export type CreateReviewCandidate = (
  input: CreateReviewCandidateInput
) => Promise<{ readonly success: true } | { readonly success: false; readonly error: string }>;

const toProcessedSourceEventIntent = (input: CreateReviewCandidateInput) => ({
  id: input.source.processedSourceEventId,
  userId: input.userId,
  sourceFamily: input.source.sourceFamily,
  sourceId: input.source.sourceId,
  sourceEventId: input.source.sourceEventId,
  status: input.source.status,
  failureReason: input.source.failureReason,
  retryCount: input.source.retryCount,
  nextRetryAt: input.source.nextRetryAt,
  transactionId: input.source.transactionId,
  confidence: input.source.confidence,
  receivedAt: input.source.receivedAt,
  processedAt: input.source.processedAt,
  createdAt: input.now,
  updatedAt: input.now,
});

const toReviewCandidateIntent = (
  input: CreateReviewCandidateInput
): CreateReviewCandidateCommand["candidate"] => ({
  id: input.candidate.id,
  userId: input.userId,
  processedSourceEventId: input.source.processedSourceEventId,
  status: input.candidate.status,
  candidateKind: input.candidate.candidateKind,
  occurredAt: input.candidate.occurredAt,
  amount: input.candidate.money?.amount ?? null,
  currency: "COP",
  transactionType: input.candidate.transactionType ?? null,
  categoryId: input.candidate.categoryId ?? null,
  description: input.candidate.description,
  confidence: input.candidate.confidence,
  createdAt: input.now,
  updatedAt: input.now,
});

const toEvidenceIntent = (input: CreateReviewCandidateInput, row: LocalLedgerCaptureEvidence) => ({
  id: row.id,
  linkId: row.linkId,
  userId: input.userId,
  sourceFamily: row.sourceFamily,
  evidenceType: row.evidenceType,
  scope: row.scope,
  value: row.value,
  processedSourceEventId: input.source.processedSourceEventId,
  createdAt: input.now,
  updatedAt: input.now,
});

export function toCreateReviewCandidateCommand(
  input: CreateReviewCandidateInput
): CreateReviewCandidateCommand {
  return {
    kind: "localLedger.reviewCandidate.create",
    sourceEvent: toProcessedSourceEventIntent(input),
    candidate: toReviewCandidateIntent(input),
    evidence: input.evidence.map((row) => toEvidenceIntent(input, row)),
  };
}

export function createReviewCandidateUseCase(
  port: CreateReviewCandidateCommitPort
): CreateReviewCandidate {
  return async (input) => {
    const result = await port.commit(toCreateReviewCandidateCommand(input));

    return result.success ? { success: true } : { success: false, error: result.error };
  };
}
