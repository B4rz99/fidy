import { isActiveTransactionRow } from "@/features/transactions/lib/active-transaction-conditions";
import { toStoredTransaction } from "@/features/transactions/lib/build-transaction";
import { getTransactionById, upsertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { toIsoDateTime } from "@/shared/lib/format-date";
import type { IsoDateTime, ProcessedEmailId } from "@/shared/types/branded";
import {
  getNeedsReviewEmails,
  getProcessedEmailById,
  updateProcessedEmailStatus,
  updateProcessedEmailStatusInTransaction,
} from "./repository";

type DismissFinancialMeaningReviewDeps = {
  readonly now?: () => IsoDateTime;
  readonly loadProcessedEmailById?: typeof getProcessedEmailById;
  readonly loadTransactionById?: typeof getTransactionById;
  readonly saveTransactionRow?: typeof upsertTransaction;
  readonly saveProcessedEmailStatus?: typeof updateProcessedEmailStatusInTransaction;
};

export async function getFinancialMeaningReviewItems(db: AnyDb) {
  const emails = await getNeedsReviewEmails(db);

  return emails.flatMap((processedEmail) => {
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
