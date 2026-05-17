import type {
  LocalLedgerCaptureEvidence,
  LocalLedgerCommandId,
  LocalLedgerProcessedSourceEventId,
  LocalLedgerProcessedSourceEventStatus,
  LocalLedgerReviewCandidate,
  LocalLedgerSourceId,
} from "../domain/public";

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
  readonly processedSourceEventRow: {
    readonly id: string;
    readonly userId: string;
    readonly sourceFamily: string;
    readonly sourceId: string;
    readonly sourceEventId: string;
    readonly status: LocalLedgerProcessedSourceEventStatus;
    readonly failureReason: string | null;
    readonly subject?: string | null;
    readonly retryCount?: number;
    readonly nextRetryAt?: string | null;
    readonly transactionId?: string | null;
    readonly confidence?: number | null;
    readonly receivedAt: string;
    readonly processedAt: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly deletedAt: string | null;
  };
  readonly reviewCandidateRow: {
    readonly id: string;
    readonly userId: string;
    readonly processedSourceEventId: string;
    readonly status: LocalLedgerReviewCandidate["status"];
    readonly candidateKind: LocalLedgerReviewCandidate["candidateKind"];
    readonly occurredAt: string | null;
    readonly amount: number | null;
    readonly currency: "COP";
    readonly transactionType?: "expense" | "income" | null;
    readonly categoryId?: string | null;
    readonly description: string | null;
    readonly confidence: number | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly deletedAt: string | null;
  };
  readonly evidenceRows: readonly {
    readonly id: string;
    readonly userId: string;
    readonly sourceFamily: string;
    readonly evidenceType: string;
    readonly scope: string;
    readonly value: string;
    readonly transactionId: null;
    readonly transferId: null;
    readonly processedSourceEventId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly deletedAt: string | null;
  }[];
  readonly evidenceLinkRows: readonly {
    readonly id: string;
    readonly userId: string;
    readonly reviewCandidateId: string;
    readonly captureEvidenceId: string;
    readonly createdAt: string;
    readonly deletedAt: string | null;
  }[];
};

export type CreateReviewCandidateInput = {
  readonly commandId: LocalLedgerCommandId;
  readonly userId: string;
  readonly source: {
    readonly processedSourceEventId: LocalLedgerProcessedSourceEventId;
    readonly sourceFamily: string;
    readonly sourceId: LocalLedgerSourceId;
    readonly sourceEventId: string;
    readonly receivedAt: string;
    readonly processedAt: string;
    readonly status: LocalLedgerProcessedSourceEventStatus;
    readonly failureReason: string | null;
    readonly subject?: string | null;
    readonly retryCount?: number;
    readonly nextRetryAt?: string | null;
    readonly transactionId?: string | null;
    readonly confidence?: number | null;
  };
  readonly candidate: LocalLedgerReviewCandidate;
  readonly evidence: readonly LocalLedgerCaptureEvidence[];
  readonly now: string;
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

const toProcessedSourceEventRow = (input: CreateReviewCandidateInput) => ({
  id: input.source.processedSourceEventId,
  userId: input.userId,
  sourceFamily: input.source.sourceFamily,
  sourceId: input.source.sourceId,
  sourceEventId: input.source.sourceEventId,
  status: input.source.status,
  failureReason: input.source.failureReason,
  subject: input.source.subject,
  retryCount: input.source.retryCount,
  nextRetryAt: input.source.nextRetryAt,
  transactionId: input.source.transactionId,
  confidence: input.source.confidence,
  receivedAt: input.source.receivedAt,
  processedAt: input.source.processedAt,
  createdAt: input.now,
  updatedAt: input.now,
  deletedAt: null,
});

const toReviewCandidateRow = (
  input: CreateReviewCandidateInput
): CreateReviewCandidateCommand["reviewCandidateRow"] => ({
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
  deletedAt: null,
});

const toEvidenceRow = (input: CreateReviewCandidateInput, row: LocalLedgerCaptureEvidence) => ({
  id: row.id,
  userId: input.userId,
  sourceFamily: row.sourceFamily,
  evidenceType: row.evidenceType,
  scope: row.scope,
  value: row.value,
  transactionId: null,
  transferId: null,
  processedSourceEventId: input.source.processedSourceEventId,
  createdAt: input.now,
  updatedAt: input.now,
  deletedAt: null,
});

const toEvidenceLinkRow = (input: CreateReviewCandidateInput, row: LocalLedgerCaptureEvidence) => ({
  id: row.linkId,
  userId: input.userId,
  reviewCandidateId: input.candidate.id,
  captureEvidenceId: row.id,
  createdAt: input.now,
  deletedAt: null,
});

export function toCreateReviewCandidateCommand(
  input: CreateReviewCandidateInput
): CreateReviewCandidateCommand {
  return {
    kind: "localLedger.reviewCandidate.create",
    processedSourceEventRow: toProcessedSourceEventRow(input),
    reviewCandidateRow: toReviewCandidateRow(input),
    evidenceRows: input.evidence.map((row) => toEvidenceRow(input, row)),
    evidenceLinkRows: input.evidence.map((row) => toEvidenceLinkRow(input, row)),
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
