import { z } from "zod";
import { requireCategoryId, requireCopAmount, requireIsoDate } from "@/shared/types/assertions";
import type { CategoryId, CopAmount, IsoDate } from "@/shared/types/branded";

type CaptureInterpreterOptions = {
  readonly validCategoryIds: readonly string[];
};

export type TransactionCandidate = {
  readonly kind: "transaction";
  readonly type: "expense" | "income";
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string;
  readonly date: string;
  readonly confidence: number;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
};

export type TransferCandidate = {
  readonly kind: "transfer";
  readonly amount: number;
  readonly date: string;
  readonly description: string;
  readonly confidence: number;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
};

export type NotTrackableCandidate = {
  readonly kind: "not_trackable";
  readonly reason: string;
  readonly confidence: number;
};

export type NeedsReviewCandidate = {
  readonly kind: "needs_review";
  readonly reason: string;
  readonly confidence: number;
};

export type CaptureInterpreterCandidate =
  | TransactionCandidate
  | TransferCandidate
  | NotTrackableCandidate
  | NeedsReviewCandidate;

export type LocalLedgerTransaction = {
  readonly type: "expense" | "income";
  readonly amount: CopAmount;
  readonly categoryId: CategoryId;
  readonly description: string;
  readonly date: IsoDate;
  readonly confidence: number;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
};

export type CaptureCandidateInterpretation =
  | { readonly kind: "candidate"; readonly candidate: CaptureInterpreterCandidate }
  | { readonly kind: "invalid"; readonly reasons: readonly string[] };

export type LocalLedgerCandidateValidation =
  | { readonly kind: "accepted"; readonly transaction: LocalLedgerTransaction }
  | { readonly kind: "needs_review"; readonly reason: string }
  | { readonly kind: "not_trackable"; readonly reason: string }
  | { readonly kind: "rejected"; readonly reason: string };

const confidenceSchema = z.number().min(0).max(1);
const undefinedIfNull = (value: string | null | undefined) => value ?? undefined;
const transactionCandidateSchema = z.object({
  kind: z.literal("transaction"),
  type: z.enum(["expense", "income"]),
  amount: z.number(),
  categoryId: z.string().min(1),
  description: z.string().trim().min(1),
  date: z.string().min(1),
  confidence: confidenceSchema,
  fromAccountHint: z.string().nullish().transform(undefinedIfNull),
  toAccountHint: z.string().nullish().transform(undefinedIfNull),
  cardProductHint: z.string().nullish().transform(undefinedIfNull),
  accountTypeHint: z.string().nullish().transform(undefinedIfNull),
  counterpartyHint: z.string().nullish().transform(undefinedIfNull),
});
const transferCandidateSchema = z.object({
  kind: z.literal("transfer"),
  amount: z.number(),
  date: z.string().min(1),
  description: z.string().trim().min(1),
  confidence: confidenceSchema,
  fromAccountHint: z.string().nullish().transform(undefinedIfNull),
  toAccountHint: z.string().nullish().transform(undefinedIfNull),
  cardProductHint: z.string().nullish().transform(undefinedIfNull),
  accountTypeHint: z.string().nullish().transform(undefinedIfNull),
  counterpartyHint: z.string().nullish().transform(undefinedIfNull),
});
const notTrackableCandidateSchema = z.object({
  kind: z.literal("not_trackable"),
  reason: z.string().trim().min(1),
  confidence: confidenceSchema,
});
const needsReviewCandidateSchema = z.object({
  kind: z.literal("needs_review"),
  reason: z.string().trim().min(1),
  confidence: confidenceSchema,
});
const captureInterpreterCandidateSchema = z.discriminatedUnion("kind", [
  transactionCandidateSchema,
  transferCandidateSchema,
  notTrackableCandidateSchema,
  needsReviewCandidateSchema,
]);

function isKnownCategory(categoryId: string, validCategoryIds: readonly string[]) {
  return validCategoryIds.includes(categoryId);
}

function toValidationFailure(error: unknown, reason: string): LocalLedgerCandidateValidation {
  return error instanceof Error
    ? { kind: "rejected", reason: error.message }
    : { kind: "rejected", reason };
}

function validateTransactionCandidate(
  candidate: TransactionCandidate,
  options: CaptureInterpreterOptions
): LocalLedgerCandidateValidation {
  if (!isKnownCategory(candidate.categoryId, options.validCategoryIds)) {
    return { kind: "rejected", reason: "categoryId is not a local ledger category" };
  }
  if (candidate.amount === 0) {
    return { kind: "rejected", reason: "amount must be greater than zero" };
  }

  try {
    return {
      kind: "accepted",
      transaction: {
        type: candidate.type,
        amount: requireCopAmount(candidate.amount),
        categoryId: requireCategoryId(candidate.categoryId),
        description: candidate.description,
        date: requireIsoDate(candidate.date),
        confidence: candidate.confidence,
        fromAccountHint: candidate.fromAccountHint,
        toAccountHint: candidate.toAccountHint,
        cardProductHint: candidate.cardProductHint,
        accountTypeHint: candidate.accountTypeHint,
        counterpartyHint: candidate.counterpartyHint,
      },
    };
  } catch (error) {
    return toValidationFailure(error, "transaction candidate failed local validation");
  }
}

export function buildTransactionCandidate(input: {
  readonly type: "expense" | "income";
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string;
  readonly date: string;
  readonly confidence: number;
}): TransactionCandidate {
  return { kind: "transaction", ...input };
}

export function interpretCaptureCandidate(
  data: unknown,
  _options: CaptureInterpreterOptions
): CaptureCandidateInterpretation {
  const parsed = captureInterpreterCandidateSchema.safeParse(data);

  return parsed.success
    ? { kind: "candidate", candidate: parsed.data }
    : {
        kind: "invalid",
        reasons: parsed.error.issues.map((issue) => issue.message),
      };
}

export function validateCaptureCandidateForLocalLedger(
  candidate: CaptureInterpreterCandidate,
  options: CaptureInterpreterOptions
): LocalLedgerCandidateValidation {
  switch (candidate.kind) {
    case "transaction":
      return validateTransactionCandidate(candidate, options);
    case "transfer":
      return { kind: "needs_review", reason: "transfer candidates require account resolution" };
    case "needs_review":
      return { kind: "needs_review", reason: candidate.reason };
    case "not_trackable":
      return { kind: "not_trackable", reason: candidate.reason };
  }
}
