import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { insertTransaction, type TransactionRow } from "@/features/transactions/lib/repository";
import { getBuiltInCategoryId } from "@/shared/categories";
import type { AnyDb } from "@/shared/db/client";
import { toIsoDateTime } from "@/shared/lib/format-date";
import { generateTransactionId } from "@/shared/lib/generate-id";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import {
  acceptSourceEventFinancialMeaningReviewById,
  dismissSourceEventFinancialMeaningReviewById,
  type FinancialMeaningSourceEventReviewRow,
  getFinancialMeaningSourceEventReviewRows,
  getSourceEventReviewCandidateById,
} from "./repository";

export type FinancialMeaningReviewItem = {
  readonly kind: "source_event";
  readonly processedSourceEvent: FinancialMeaningSourceEventReviewRow["processedSourceEvent"];
  readonly reviewCandidate: FinancialMeaningSourceEventReviewRow["reviewCandidate"];
};

export async function getFinancialMeaningReviewItems(db: AnyDb, userId: UserId) {
  const sourceEventRows = await getFinancialMeaningSourceEventReviewRows(db, userId);
  return sourceEventRows
    .map(
      (row): FinancialMeaningReviewItem => ({
        kind: "source_event",
        processedSourceEvent: row.processedSourceEvent,
        reviewCandidate: row.reviewCandidate,
      })
    )
    .sort((left, right) =>
      right.processedSourceEvent.receivedAt.localeCompare(left.processedSourceEvent.receivedAt)
    );
}

export async function confirmSourceEventFinancialMeaningReview(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly now?: () => IsoDateTime;
  }
) {
  const updatedAt = input.now?.() ?? toIsoDateTime(new Date());
  const defaultAccount = ensureDefaultFinancialAccount(db, input.userId, { now: updatedAt });
  const transactionId = generateTransactionId();

  return db.transaction((tx) =>
    confirmSourceEventReviewInTransaction(tx, {
      ...input,
      defaultAccountId: defaultAccount.id,
      transactionId,
      updatedAt,
    })
  );
}

function confirmSourceEventReviewInTransaction(
  tx: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly defaultAccountId: FinancialAccountId;
    readonly transactionId: TransactionId;
    readonly updatedAt: IsoDateTime;
  }
) {
  const row = getSourceEventReviewCandidateById(tx, {
    userId: input.userId,
    processedSourceEventId: input.processedSourceEventId,
    reviewCandidateId: input.reviewCandidateId,
  });
  if (!canConfirmSourceEventReview(row)) return false;

  const occurredOn = (row.reviewCandidate.occurredAt ?? row.processedSourceEvent.receivedAt).slice(
    0,
    10
  ) as IsoDate;
  const accepted = acceptSourceEventFinancialMeaningReviewById(tx, input);
  if (!accepted) return false;

  insertTransaction(tx, buildSourceEventReviewTransactionRow(input, row, occurredOn));
  return true;
}

function canConfirmSourceEventReview(
  row: ReturnType<typeof getSourceEventReviewCandidateById>
): row is NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>> {
  return row != null && row.reviewCandidate.amount != null;
}

const getReviewCandidateTransactionType = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
) => row.reviewCandidate.transactionType ?? "expense";

const getReviewCandidateCategoryId = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
) => row.reviewCandidate.categoryId ?? getBuiltInCategoryId("other");

const getReviewCandidateDescription = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
) => row.reviewCandidate.description ?? row.processedSourceEvent.rawBodyPreview ?? null;

function buildSourceEventReviewTransactionRow(
  input: {
    readonly userId: UserId;
    readonly defaultAccountId: FinancialAccountId;
    readonly transactionId: TransactionId;
    readonly updatedAt: IsoDateTime;
  },
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>,
  occurredOn: IsoDate
): TransactionRow {
  return {
    id: input.transactionId,
    userId: input.userId,
    type: getReviewCandidateTransactionType(row),
    amount: row.reviewCandidate.amount as CopAmount,
    categoryId: getReviewCandidateCategoryId(row),
    description: getReviewCandidateDescription(row),
    date: occurredOn,
    accountId: input.defaultAccountId,
    accountAttributionState: "unresolved",
    source: "email_capture",
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  };
}

export async function dismissSourceEventFinancialMeaningReview(
  db: AnyDb,
  userId: UserId,
  processedSourceEventId: ProcessedSourceEventId,
  reviewCandidateId: ReviewCandidateId,
  now: () => IsoDateTime = () => toIsoDateTime(new Date())
) {
  dismissSourceEventFinancialMeaningReviewById(db, {
    userId,
    processedSourceEventId,
    reviewCandidateId,
    updatedAt: now(),
  });
}
