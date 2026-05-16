import type { IsoDateTime, ProcessedSourceEventId, UserId } from "@/shared/types/branded";
import type { LocalLedgerReviewCandidateId } from "../domain/public";
import type {
  RecordTransactionCommand,
  RecordTransactionResult,
  RecordTransferCommand,
  RecordTransferResult,
} from "./write.public";

export type ReviewCandidateResolutionRecord = {
  readonly id: LocalLedgerReviewCandidateId;
  readonly userId: UserId;
  readonly processedSourceEventId: ProcessedSourceEventId;
  readonly status: "pending" | "accepted" | "rejected";
  readonly candidateKind: "transaction" | "transfer";
};

export type ReviewCandidateResolutionInput = {
  readonly userId: UserId;
  readonly candidateId: LocalLedgerReviewCandidateId;
  readonly processedSourceEventId: ProcessedSourceEventId;
  readonly now: IsoDateTime;
};

export type ConfirmReviewCandidateAsTransactionInput = ReviewCandidateResolutionInput & {
  readonly command: RecordTransactionCommand;
};

export type ConfirmReviewCandidateAsTransferInput = ReviewCandidateResolutionInput & {
  readonly command: RecordTransferCommand;
};

export type ReviewCandidateResolutionCommitInput = ReviewCandidateResolutionInput;

export type ReviewCandidateResolutionCommitResult =
  | { readonly success: true; readonly didMutate?: boolean }
  | { readonly success: false; readonly error: string };

export type ConfirmReviewCandidateTransactionCommitInput = ReviewCandidateResolutionCommitInput & {
  readonly command: RecordTransactionCommand;
};

export type ConfirmReviewCandidateTransferCommitInput = ReviewCandidateResolutionCommitInput & {
  readonly command: RecordTransferCommand;
};

export type ConfirmReviewCandidateTransactionCommitResult =
  | { readonly ok: true; readonly recorded: RecordTransactionResult & { readonly ok: true } }
  | { readonly ok: false; readonly code: "recording-rejected"; readonly reason: string }
  | { readonly ok: false; readonly code: "commit-failed"; readonly reason: string };

export type ConfirmReviewCandidateTransferCommitResult =
  | {
      readonly ok: true;
      readonly recorded: Extract<RecordTransferResult, { readonly code: "recorded" }>;
    }
  | { readonly ok: false; readonly code: "recording-rejected"; readonly reason: string }
  | { readonly ok: false; readonly code: "commit-failed"; readonly reason: string };

export type ConfirmReviewCandidateAsTransactionPorts = {
  readonly loadCandidate: (
    input: ReviewCandidateResolutionInput
  ) => Promise<ReviewCandidateResolutionRecord | null>;
  readonly confirmTransaction: (
    input: ConfirmReviewCandidateTransactionCommitInput
  ) => Promise<ConfirmReviewCandidateTransactionCommitResult>;
};

export type ConfirmReviewCandidateAsTransferPorts = {
  readonly loadCandidate: (
    input: ReviewCandidateResolutionInput
  ) => Promise<ReviewCandidateResolutionRecord | null>;
  readonly confirmTransfer: (
    input: ConfirmReviewCandidateTransferCommitInput
  ) => Promise<ConfirmReviewCandidateTransferCommitResult>;
};

export type DismissReviewCandidatePorts = {
  readonly loadCandidate: (
    input: ReviewCandidateResolutionInput
  ) => Promise<ReviewCandidateResolutionRecord | null>;
  readonly rejectCandidate: (
    input: ReviewCandidateResolutionCommitInput
  ) => Promise<ReviewCandidateResolutionCommitResult>;
};

export type ResolveReviewCandidateCommand = {
  readonly kind: "localLedger.reviewCandidate.resolve";
  readonly userId: UserId;
  readonly reviewCandidateId: LocalLedgerReviewCandidateId;
  readonly processedSourceEventId: ProcessedSourceEventId;
  readonly reviewCandidateStatus: "accepted" | "rejected";
  readonly processedSourceEventStatus: "processed" | "dismissed";
  readonly now: IsoDateTime;
};

export type ReviewCandidateResolutionRejection =
  | "candidate-not-found"
  | "candidate-owner-mismatch"
  | "source-event-mismatch"
  | "candidate-not-pending"
  | "candidate-kind-mismatch"
  | "record-command-user-mismatch"
  | "recording-rejected"
  | "commit-failed";

export type ConfirmReviewCandidateResult =
  | { readonly ok: true; readonly code: "accepted"; readonly recorded: unknown }
  | {
      readonly ok: false;
      readonly code: ReviewCandidateResolutionRejection;
      readonly reason?: string;
    };

export type DismissReviewCandidateResult =
  | { readonly ok: true; readonly code: "rejected" }
  | {
      readonly ok: false;
      readonly code: ReviewCandidateResolutionRejection;
      readonly reason?: string;
    };

const reject = (
  code: ReviewCandidateResolutionRejection,
  reason?: string
): Extract<ConfirmReviewCandidateResult, { ok: false }> => ({
  ok: false,
  code,
  ...(reason === undefined ? {} : { reason }),
});

const toCommitInput = (
  input: ReviewCandidateResolutionInput
): ReviewCandidateResolutionCommitInput => ({
  userId: input.userId,
  candidateId: input.candidateId,
  processedSourceEventId: input.processedSourceEventId,
  now: input.now,
});

const toResolveReviewCandidateCommand = (
  input: ReviewCandidateResolutionCommitInput,
  reviewCandidateStatus: ResolveReviewCandidateCommand["reviewCandidateStatus"]
): ResolveReviewCandidateCommand => ({
  kind: "localLedger.reviewCandidate.resolve",
  userId: input.userId,
  reviewCandidateId: input.candidateId,
  processedSourceEventId: input.processedSourceEventId,
  reviewCandidateStatus,
  processedSourceEventStatus: "processed",
  now: input.now,
});

export const toAcceptReviewCandidateCommand = (
  input: ReviewCandidateResolutionCommitInput
): ResolveReviewCandidateCommand => toResolveReviewCandidateCommand(input, "accepted");

export const toRejectReviewCandidateCommand = (
  input: ReviewCandidateResolutionCommitInput
): ResolveReviewCandidateCommand => ({
  ...toResolveReviewCandidateCommand(input, "rejected"),
  processedSourceEventStatus: "dismissed",
});

async function validateCandidate(
  input: ReviewCandidateResolutionInput,
  expectedKind: ReviewCandidateResolutionRecord["candidateKind"] | null,
  loadCandidate: (
    input: ReviewCandidateResolutionInput
  ) => Promise<ReviewCandidateResolutionRecord | null>
) {
  const candidate = await loadCandidate(input);

  return candidate === null
    ? reject("candidate-not-found")
    : candidate.userId !== input.userId
      ? reject("candidate-owner-mismatch")
      : candidate.processedSourceEventId !== input.processedSourceEventId
        ? reject("source-event-mismatch")
        : candidate.status !== "pending"
          ? reject("candidate-not-pending")
          : expectedKind !== null && candidate.candidateKind !== expectedKind
            ? reject("candidate-kind-mismatch")
            : null;
}

export async function confirmReviewCandidateAsTransaction(
  input: ConfirmReviewCandidateAsTransactionInput,
  ports: ConfirmReviewCandidateAsTransactionPorts
): Promise<ConfirmReviewCandidateResult> {
  const validation = await validateCandidate(input, "transaction", ports.loadCandidate);
  if (validation !== null) return validation;
  if (input.command.userId !== input.userId) return reject("record-command-user-mismatch");

  const commitResult = await ports.confirmTransaction({
    ...toCommitInput(input),
    command: input.command,
  });
  return commitResult.ok
    ? { ok: true, code: "accepted", recorded: commitResult.recorded.transaction }
    : reject(commitResult.code, commitResult.reason);
}

export async function confirmReviewCandidateAsTransfer(
  input: ConfirmReviewCandidateAsTransferInput,
  ports: ConfirmReviewCandidateAsTransferPorts
): Promise<ConfirmReviewCandidateResult> {
  const validation = await validateCandidate(input, "transfer", ports.loadCandidate);
  if (validation !== null) return validation;

  const commitResult = await ports.confirmTransfer({
    ...toCommitInput(input),
    command: input.command,
  });
  return commitResult.ok
    ? { ok: true, code: "accepted", recorded: commitResult.recorded.transfer }
    : reject(commitResult.code, commitResult.reason);
}

export async function dismissReviewCandidate(
  input: ReviewCandidateResolutionInput,
  ports: DismissReviewCandidatePorts
): Promise<DismissReviewCandidateResult> {
  const validation = await validateCandidate(input, null, ports.loadCandidate);
  if (validation !== null) return validation;

  const commitResult = await ports.rejectCandidate(toCommitInput(input));
  return commitResult.success
    ? { ok: true, code: "rejected" }
    : reject("commit-failed", commitResult.error);
}
