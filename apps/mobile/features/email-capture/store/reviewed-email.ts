import { eq } from "drizzle-orm";
import { isValidCategoryId } from "@/features/transactions/write.public";
import type { AnyDb } from "@/shared/db";
import { transactions } from "@/shared/db";
import { normalizeMerchant, toIsoDateTime } from "@/shared/lib";
import type { CategoryId, IsoDateTime, TransactionId, UserId } from "@/shared/types/branded";
import { insertMerchantRule } from "../lib/merchant-rules";
import { updateProcessedEmailStatus } from "../lib/repository";
import {
  createEmailCaptureSession,
  isActiveEmailCaptureSession,
} from "../services/email-capture-store-runtime";
import { type RefreshTransactions, useEmailCaptureStore } from "./state";

const noopRefreshTransactions: RefreshTransactions = () => undefined;

function getNeedsReviewEmailById(processedEmailId: string) {
  return (
    useEmailCaptureStore
      .getState()
      .needsReviewEmails.find((email) => email.id === processedEmailId) ?? null
  );
}

async function getTransactionDescription(db: AnyDb, transactionId: TransactionId) {
  const txRows = await db
    .select({ description: transactions.description })
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  return txRows[0]?.description ?? null;
}

async function saveMerchantRuleForReviewedEmail(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly description: string | null;
  readonly categoryId: CategoryId;
  readonly now: IsoDateTime;
}) {
  if (!input.description) return;

  await insertMerchantRule(
    input.db,
    input.userId,
    normalizeMerchant(input.description),
    input.categoryId,
    input.now
  );
}

export async function confirmReviewedEmail(
  db: AnyDb,
  userId: UserId,
  processedEmailId: string,
  categoryId: string,
  refreshTransactions: RefreshTransactions = noopRefreshTransactions
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return;

  const processedEmail = getNeedsReviewEmailById(processedEmailId);
  if (!processedEmail?.transactionId || !isValidCategoryId(categoryId)) return;

  const now = toIsoDateTime(new Date());

  await db
    .update(transactions)
    .set({ categoryId, updatedAt: now })
    .where(eq(transactions.id, processedEmail.transactionId));

  await saveMerchantRuleForReviewedEmail({
    db,
    userId,
    description: await getTransactionDescription(db, processedEmail.transactionId),
    categoryId,
    now,
  });

  await updateProcessedEmailStatus({
    db,
    id: processedEmail.id,
    status: "success",
    transactionId: processedEmail.transactionId,
  });
  if (!isActiveEmailCaptureSession(session)) return;

  useEmailCaptureStore.getState().removeNeedsReviewEmail(processedEmailId);
  await refreshTransactions();
}
