import type { StoredTransaction } from "@/features/transactions/schema";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import type { LocalLedgerReviewCandidateId } from "@/local-ledger/public";
import type { EmailReviewRow } from "./repository";

const OTHER_CATEGORY_ID = "other" as CategoryId;

type CandidatePreviewInput = EmailReviewRow & {
  readonly reviewCandidateId: LocalLedgerReviewCandidateId;
  readonly reviewCandidateAmount: number;
  readonly reviewCandidateOccurredAt: IsoDateTime;
};

const hasCandidatePreview = (
  processedEmail: EmailReviewRow
): processedEmail is CandidatePreviewInput =>
  Boolean(processedEmail.reviewCandidateId) &&
  processedEmail.reviewCandidateAmount != null &&
  processedEmail.reviewCandidateOccurredAt != null;

const toCandidatePreviewTransactionRow = (
  processedEmail: CandidatePreviewInput
): StoredTransaction => {
  const occurredAt = new Date(processedEmail.reviewCandidateOccurredAt);
  const createdAt = new Date(processedEmail.createdAt);
  return {
    id: processedEmail.reviewCandidateId as unknown as TransactionId,
    userId: "review-candidate" as UserId,
    type: "expense",
    amount: processedEmail.reviewCandidateAmount as CopAmount,
    categoryId: OTHER_CATEGORY_ID,
    description: processedEmail.reviewCandidateDescription ?? processedEmail.subject,
    counterpartyName: processedEmail.reviewCandidateDescription ?? "",
    date: occurredAt,
    createdAt,
    updatedAt: createdAt,
    voidedAt: null,
    accountId: "" as FinancialAccountId,
    accountAttributionState: "unresolved",
    supersededAt: null,
    supersededByTransferId: null,
    source: "email_capture",
  };
};

export const toCandidatePreviewTransaction = (
  processedEmail: EmailReviewRow
): StoredTransaction | null =>
  hasCandidatePreview(processedEmail) ? toCandidatePreviewTransactionRow(processedEmail) : null;
