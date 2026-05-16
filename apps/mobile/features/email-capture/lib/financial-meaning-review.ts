import { and, eq, isNull } from "drizzle-orm";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { isActiveTransactionRow } from "@/features/transactions/lib/active-transaction-conditions";
import { toStoredTransaction } from "@/features/transactions/lib/build-transaction";
import {
  getTransactionById,
  insertTransaction,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import { toRejectReviewCandidateCommand } from "@/local-ledger/public";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db/client";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import { generateTransactionId } from "@/shared/lib";
import { toIsoDateTime } from "@/shared/lib/format-date";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  UserId,
} from "@/shared/types/branded";
import type { LocalLedgerReviewCandidateId } from "@/local-ledger/public";
import { toCandidatePreviewTransaction } from "./financial-meaning-review-preview";
import { getNeedsReviewEmails, getProcessedEmailById } from "./repository";

type DismissFinancialMeaningReviewDeps = {
  readonly now?: () => IsoDateTime;
  readonly loadProcessedEmailById?: typeof getProcessedEmailById;
  readonly loadTransactionById?: typeof getTransactionById;
  readonly saveTransactionRow?: typeof upsertTransaction;
};

type ReviewCandidateTarget = {
  readonly id: LocalLedgerReviewCandidateId;
  readonly userId: UserId;
  readonly processedSourceEventId: ProcessedSourceEventId;
  readonly occurredAt: IsoDateTime | null;
  readonly amount: CopAmount | null;
  readonly description: string | null;
};

const OTHER_CATEGORY_ID = "other" as CategoryId;

async function loadReviewCandidateResolutionTarget(db: AnyDb, id: string) {
  const rows = await db
    .select({
      id: reviewCandidates.id,
      userId: reviewCandidates.userId,
      processedSourceEventId: reviewCandidates.processedSourceEventId,
      occurredAt: reviewCandidates.occurredAt,
      amount: reviewCandidates.amount,
      description: reviewCandidates.description,
    })
    .from(reviewCandidates)
    .innerJoin(
      processedSourceEvents,
      eq(reviewCandidates.processedSourceEventId, processedSourceEvents.id)
    )
    .where(
      and(
        eq(reviewCandidates.id, id as unknown as LocalLedgerReviewCandidateId),
        eq(reviewCandidates.status, "pending"),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(reviewCandidates.deletedAt),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

async function rejectLocalLedgerReviewCandidate(input: {
  readonly db: AnyDb;
  readonly id: string;
  readonly now: IsoDateTime;
}) {
  const target = await loadReviewCandidateResolutionTarget(input.db, input.id);
  if (!target) return false;

  const commandInput = {
    userId: target.userId as UserId,
    candidateId: target.id as LocalLedgerReviewCandidateId,
    processedSourceEventId: target.processedSourceEventId as ProcessedSourceEventId,
    now: input.now,
  };
  const command = toRejectReviewCandidateCommand(commandInput);
  const result = await createWriteThroughMutationModule(input.db).commit(command);
  if (!result.success) throw new Error(result.error);
  return true;
}

function canAcceptCandidate(
  target: ReviewCandidateTarget | null
): target is ReviewCandidateTarget & {
  readonly occurredAt: IsoDateTime;
  readonly amount: CopAmount;
} {
  return target?.occurredAt != null && target.amount != null;
}

function insertAcceptedCandidateTransaction(input: {
  readonly tx: AnyDb;
  readonly target: ReviewCandidateTarget & {
    readonly occurredAt: IsoDateTime;
    readonly amount: CopAmount;
  };
  readonly categoryId: CategoryId;
  readonly accountId: FinancialAccountId;
  readonly now: IsoDateTime;
}) {
  insertTransaction(input.tx, {
    id: generateTransactionId(),
    userId: input.target.userId,
    type: "expense",
    amount: input.target.amount,
    categoryId: input.categoryId,
    description: input.target.description ?? "",
    date: input.target.occurredAt.slice(0, 10) as IsoDate,
    accountId: input.accountId,
    accountAttributionState: "unresolved",
    source: "email_capture",
    counterpartyName: input.target.description ?? "",
    createdAt: input.now,
    updatedAt: input.now,
    voidedAt: null,
    supersededAt: null,
    supersededByTransferId: null,
  });
}

function markCandidateAccepted(input: {
  readonly tx: AnyDb;
  readonly target: ReviewCandidateTarget;
  readonly now: IsoDateTime;
}) {
  input.tx
    .update(reviewCandidates)
    .set({ status: "accepted", updatedAt: input.now })
    .where(
      and(
        eq(reviewCandidates.id, input.target.id),
        eq(reviewCandidates.userId, input.target.userId),
        eq(reviewCandidates.processedSourceEventId, input.target.processedSourceEventId),
        eq(reviewCandidates.status, "pending"),
        isNull(reviewCandidates.deletedAt)
      )
    )
    .run();
}

function markCandidateSourceEventProcessed(input: {
  readonly tx: AnyDb;
  readonly target: ReviewCandidateTarget;
  readonly now: IsoDateTime;
}) {
  input.tx
    .update(processedSourceEvents)
    .set({ status: "processed", updatedAt: input.now })
    .where(
      and(
        eq(processedSourceEvents.id, input.target.processedSourceEventId),
        eq(processedSourceEvents.userId, input.target.userId),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();
}

export async function acceptFinancialMeaningReviewCandidate(input: {
  readonly db: AnyDb;
  readonly candidateId: string;
  readonly categoryId: CategoryId;
  readonly now: IsoDateTime;
}) {
  const target = await loadReviewCandidateResolutionTarget(input.db, input.candidateId);
  if (!canAcceptCandidate(target)) return false;

  const defaultAccount = ensureDefaultFinancialAccount(input.db, target.userId, { now: input.now });
  input.db.transaction((tx) => {
    insertAcceptedCandidateTransaction({
      tx,
      target,
      categoryId: input.categoryId,
      accountId: defaultAccount.id,
      now: input.now,
    });
    markCandidateAccepted({ tx, target, now: input.now });
    markCandidateSourceEventProcessed({ tx, target, now: input.now });
  });
  return true;
}

export async function getFinancialMeaningReviewItems(db: AnyDb, userId?: UserId) {
  if (!userId) return [];
  const emails = await getNeedsReviewEmails(db, userId);

  return emails.flatMap((processedEmail) => {
    const candidatePreview = toCandidatePreviewTransaction(processedEmail);
    if (candidatePreview) {
      return [{ processedEmail, transaction: candidatePreview }];
    }

    if (processedEmail.transactionId == null) {
      return [];
    }

    const transaction = getTransactionById(db, processedEmail.transactionId);

    if (transaction == null || !isActiveTransactionRow(transaction)) {
      return [];
    }

    return [
      {
        processedEmail,
        transaction: toStoredTransaction(transaction),
      },
    ];
  });
}

export async function resolveFinancialMeaningReview(db: AnyDb, processedEmailId: ProcessedEmailId) {
  await acceptFinancialMeaningReviewCandidate({
    db,
    candidateId: processedEmailId,
    categoryId: OTHER_CATEGORY_ID,
    now: toIsoDateTime(new Date()),
  });
}

export async function dismissFinancialMeaningReview(
  db: AnyDb,
  processedEmailId: ProcessedEmailId,
  {
    now = () => toIsoDateTime(new Date()),
    loadProcessedEmailById = getProcessedEmailById,
    loadTransactionById = getTransactionById,
    saveTransactionRow = upsertTransaction,
  }: DismissFinancialMeaningReviewDeps = {}
) {
  const resolvedCandidate = await rejectLocalLedgerReviewCandidate({
    db,
    id: processedEmailId,
    now: now(),
  });
  if (resolvedCandidate) return;

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
  });
}
