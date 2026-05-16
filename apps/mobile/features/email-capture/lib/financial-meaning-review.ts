import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { isActiveTransactionRow } from "@/features/transactions/lib/active-transaction-conditions";
import { toStoredTransaction } from "@/features/transactions/lib/build-transaction";
import {
  getTransactionById,
  insertTransaction,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import { getBuiltInCategoryId } from "@/shared/categories";
import type { AnyDb } from "@/shared/db/client";
import { toIsoDateTime } from "@/shared/lib/format-date";
import { generateTransactionId } from "@/shared/lib/generate-id";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedEmailId,
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
  getNeedsReviewEmails,
  getProcessedEmailById,
  getSourceEventReviewCandidateById,
  updateProcessedEmailStatus,
  updateProcessedEmailStatusInTransaction,
} from "./repository";

export type FinancialMeaningReviewItem =
  | {
      readonly kind: "legacy_email";
      readonly processedEmail: Awaited<ReturnType<typeof getNeedsReviewEmails>>[number];
      readonly transaction: ReturnType<typeof toStoredTransaction>;
    }
  | {
      readonly kind: "source_event";
      readonly processedSourceEvent: FinancialMeaningSourceEventReviewRow["processedSourceEvent"];
      readonly reviewCandidate: FinancialMeaningSourceEventReviewRow["reviewCandidate"];
    };

type DismissFinancialMeaningReviewDeps = {
  readonly now?: () => IsoDateTime;
  readonly loadProcessedEmailById?: typeof getProcessedEmailById;
  readonly loadTransactionById?: typeof getTransactionById;
  readonly saveTransactionRow?: typeof upsertTransaction;
  readonly saveProcessedEmailStatus?: typeof updateProcessedEmailStatusInTransaction;
};

export async function getFinancialMeaningReviewItems(db: AnyDb, userId: UserId) {
  const emails = await getNeedsReviewEmails(db);
  const sourceEventRows = await getFinancialMeaningSourceEventReviewRows(db, userId);

  const legacyItems = emails.flatMap((processedEmail): FinancialMeaningReviewItem[] => {
    if (processedEmail.transactionId == null) {
      return [];
    }

    const transaction = getTransactionById(db, processedEmail.transactionId);

    if (transaction == null || !isActiveTransactionRow(transaction)) {
      return [];
    }

    return [
      {
        kind: "legacy_email",
        processedEmail,
        transaction: toStoredTransaction(transaction),
      },
    ];
  });

  return [
    ...legacyItems,
    ...sourceEventRows.map(
      (row): FinancialMeaningReviewItem => ({
        kind: "source_event",
        processedSourceEvent: row.processedSourceEvent,
        reviewCandidate: row.reviewCandidate,
      })
    ),
  ].sort((left, right) =>
    getReviewItemReceivedAt(right).localeCompare(getReviewItemReceivedAt(left))
  );
}

const getReviewItemReceivedAt = (item: FinancialMeaningReviewItem) =>
  item.kind === "legacy_email"
    ? item.processedEmail.receivedAt
    : item.processedSourceEvent.receivedAt;

export async function resolveFinancialMeaningReview(db: AnyDb, processedEmailId: ProcessedEmailId) {
  const processedEmail = await getProcessedEmailById(db, processedEmailId);

  if (!processedEmail) {
    return;
  }

  await updateProcessedEmailStatus({
    db,
    id: processedEmailId,
    status: "success",
    transactionId: processedEmail.transactionId ?? null,
  });
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
) {
  return {
    id: input.transactionId,
    userId: input.userId,
    type: getReviewCandidateTransactionType(row),
    amount: row.reviewCandidate.amount as CopAmount,
    categoryId: getReviewCandidateCategoryId(row),
    description: getReviewCandidateDescription(row),
    date: occurredOn,
    accountId: input.defaultAccountId,
    accountAttributionState: "unresolved" as const,
    source: "email_capture" as const,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  };
}

export async function dismissFinancialMeaningReview(
  db: AnyDb,
  processedEmailId: ProcessedEmailId,
  {
    now = () => toIsoDateTime(new Date()),
    loadProcessedEmailById = getProcessedEmailById,
    loadTransactionById = getTransactionById,
    saveTransactionRow = upsertTransaction,
    saveProcessedEmailStatus = updateProcessedEmailStatusInTransaction,
  }: DismissFinancialMeaningReviewDeps = {}
) {
  const processedEmail = await loadProcessedEmailById(db, processedEmailId);

  if (!processedEmail) {
    return;
  }

  const updatedAt = now();

  db.transaction((tx) => {
    if (processedEmail.transactionId) {
      const transaction = loadTransactionById(tx, processedEmail.transactionId);

      if (transaction && isActiveTransactionRow(transaction)) {
        saveTransactionRow(tx, {
          ...transaction,
          supersededAt: updatedAt,
          updatedAt,
        });
      }
    }

    saveProcessedEmailStatus({
      db: tx,
      id: processedEmailId,
      status: "skipped",
      transactionId: null,
    });
  });
}

export async function dismissSourceEventFinancialMeaningReview(
  db: AnyDb,
  userId: UserId,
  processedSourceEventId: ProcessedSourceEventId,
  now: () => IsoDateTime = () => toIsoDateTime(new Date())
) {
  dismissSourceEventFinancialMeaningReviewById(db, {
    userId,
    processedSourceEventId,
    updatedAt: now(),
  });
}
