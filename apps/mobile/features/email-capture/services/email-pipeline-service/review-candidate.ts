import { Effect } from "effect";
import type {
  CreateReviewCandidateInput,
  LocalLedgerCaptureEvidence,
  LocalLedgerCommandId,
  LocalLedgerProcessedSourceEventId,
  LocalLedgerReviewCandidateId,
  LocalLedgerSourceId,
} from "@/local-ledger/public";
import { fromPromise } from "@/shared/effect/runtime";
import {
  generateCaptureEvidenceId,
  generateId,
  generateReviewCandidateCaptureEvidenceId,
  generateReviewCandidateId,
} from "@/shared/lib/generate-id";
import { requireCopAmount, requireIsoDate, requireIsoDateTime } from "@/shared/types/assertions";
import type { ProcessedSourceEventId } from "@/shared/types/branded";
import { EmailPipelineDeps } from "./runtime";
import { getEmailSourceId } from "./shared";
import type { CreateEmailPipelineServiceDeps, EmailTransactionContext } from "./types";

type ReviewCandidateContext = Pick<
  EmailTransactionContext,
  "db" | "userId" | "parsed" | "categoryId" | "now"
> & {
  readonly email: {
    readonly subject?: string | null;
    readonly externalId: string;
    readonly provider: string;
    readonly from?: string;
    readonly body?: string | null;
    readonly rawBody?: string | null;
    readonly receivedAt: string;
    readonly retryCount?: number | null;
  };
  readonly processedSourceEventId?: ProcessedSourceEventId;
};

const toReviewCandidateInput = (
  context: ReviewCandidateContext,
  evidenceSeeds: ReturnType<CreateEmailPipelineServiceDeps["buildEmailCaptureEvidence"]>
): CreateReviewCandidateInput => ({
  commandId: generateId("llc") as LocalLedgerCommandId,
  userId: context.userId,
  source: {
    processedSourceEventId:
      (context.processedSourceEventId as unknown as
        | LocalLedgerProcessedSourceEventId
        | undefined) ?? (generateId("pse") as LocalLedgerProcessedSourceEventId),
    sourceFamily: "email",
    sourceId: getEmailSourceId(context.email) as LocalLedgerSourceId,
    sourceEventId: context.email.externalId,
    receivedAt: requireIsoDateTime(context.email.receivedAt),
    processedAt: context.now,
    status: "needs_review",
    failureReason: null,
    subject: context.email.subject ?? null,
    rawBodyPreview: (context.email.body ?? context.email.rawBody ?? "").slice(0, 500),
    rawBody: null,
    retryCount: context.email.retryCount ?? 0,
    nextRetryAt: null,
    transactionId: null,
    confidence: context.parsed.confidence,
  },
  candidate: {
    id: generateReviewCandidateId() as unknown as LocalLedgerReviewCandidateId,
    status: "pending",
    candidateKind: "transaction",
    occurredAt: requireIsoDate(context.parsed.date),
    money: { amount: requireCopAmount(context.parsed.amount), currency: "COP" },
    transactionType: context.parsed.type,
    categoryId: context.categoryId,
    description: null,
    confidence: context.parsed.confidence,
  },
  evidence: evidenceSeeds.map(
    (seed): LocalLedgerCaptureEvidence => ({
      id: generateCaptureEvidenceId(),
      linkId: generateReviewCandidateCaptureEvidenceId(),
      sourceFamily: seed.sourceFamily,
      evidenceType: seed.evidenceType,
      scope: seed.scope,
      value: seed.value,
    })
  ),
  now: context.now,
});

const buildEvidenceSeeds = (
  context: ReviewCandidateContext,
  buildEmailCaptureEvidence: CreateEmailPipelineServiceDeps["buildEmailCaptureEvidence"]
) =>
  buildEmailCaptureEvidence({
    from: context.email.from ?? "",
    body: context.email.body ?? context.email.rawBody ?? undefined,
    fromAccountHint: context.parsed.fromAccountHint,
    toAccountHint: context.parsed.toAccountHint,
    cardProductHint: context.parsed.cardProductHint,
    accountTypeHint: context.parsed.accountTypeHint,
    counterpartyHint: context.parsed.counterpartyHint,
  });

export const commitReviewCandidate = async (
  context: ReviewCandidateContext,
  deps: CreateEmailPipelineServiceDeps
) => {
  if (!deps.createReviewCandidate) throw new Error("Review candidate intake is not configured");
  const result = await deps.createReviewCandidate(
    context.db,
    toReviewCandidateInput(context, buildEvidenceSeeds(context, deps.buildEmailCaptureEvidence))
  );
  if (!result.success) throw new Error(result.error);
};

export function persistReviewCandidateEffect(context: ReviewCandidateContext) {
  return Effect.gen(function* () {
    const deps = yield* EmailPipelineDeps.tag;
    yield* fromPromise(() => commitReviewCandidate(context, deps));
  });
}
