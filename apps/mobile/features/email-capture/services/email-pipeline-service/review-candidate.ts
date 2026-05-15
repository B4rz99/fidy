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
import { EmailPipelineDeps } from "./runtime";
import { getTransactionSource } from "./shared";
import type { CreateEmailPipelineServiceDeps, EmailTransactionContext } from "./types";

type ReviewCandidateContext = Pick<
  EmailTransactionContext,
  "db" | "userId" | "parsed" | "categoryId" | "now"
> & {
  readonly email: {
    readonly externalId: string;
    readonly provider: string;
    readonly from?: string;
    readonly body?: string | null;
    readonly rawBody?: string | null;
    readonly receivedAt: string;
  };
};

const toReviewCandidateInput = (
  context: ReviewCandidateContext,
  evidenceSeeds: ReturnType<CreateEmailPipelineServiceDeps["buildEmailCaptureEvidence"]>
): CreateReviewCandidateInput => ({
  commandId: generateId("llc") as LocalLedgerCommandId,
  userId: context.userId,
  source: {
    processedSourceEventId: generateId("pse") as LocalLedgerProcessedSourceEventId,
    sourceFamily: "email",
    sourceId: getTransactionSource(context.email.provider) as LocalLedgerSourceId,
    sourceEventId: context.email.externalId,
    receivedAt: requireIsoDateTime(context.email.receivedAt),
    processedAt: context.now,
    status: "needs_review",
    failureReason: null,
  },
  candidate: {
    id: generateReviewCandidateId() as unknown as LocalLedgerReviewCandidateId,
    status: "pending",
    candidateKind: "transaction",
    occurredAt: requireIsoDate(context.parsed.date),
    money: { amount: requireCopAmount(context.parsed.amount), currency: "COP" },
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
