import { isValidCategoryId } from "@/features/transactions/write.public";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/record-transaction";
import {
  persistCommittedCaptureSourceEventInTransaction,
  persistProcessedSourceEvent,
} from "@/infrastructure/local-ledger/source-events";
import type { AnyDb } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  captureWarning,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import { assertCopAmount, assertTransactionId } from "@/shared/types/assertions";
import type { TransactionId, UserId } from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";

// Guard against concurrent invocations (mount + immediate AppState "active").
const inFlightFingerprints = new Set<string>();

function toTransactionId(widgetEntryId: string): TransactionId {
  const transactionId = `txn-widget-${widgetEntryId}`;
  assertTransactionId(transactionId);
  return transactionId;
}

function widgetFingerprint(entryId: string, amount: number, date: string): string {
  return captureFingerprint({ source: "widget", amount, date, merchant: entryId });
}

export type WidgetPipelineResult = {
  saved: number;
  skippedDuplicate: number;
  errors: number;
};

const errorType = (error: unknown): string => (error instanceof Error ? error.name : typeof error);
const localLedgerRejectionReason = (error: string): string => `local_ledger_rejected:${error}`;
const failureReason = (error: unknown): string =>
  error instanceof Error && error.message.startsWith("local_ledger_rejected:")
    ? error.message
    : errorType(error);

export async function processWidgetTransactions(
  db: AnyDb,
  userId: UserId
): Promise<WidgetPipelineResult> {
  const { isAvailable, getPendingTransactions, removePendingTransactions } =
    await import("@/modules/expo-app-intents");

  if (!isAvailable()) {
    return { saved: 0, skippedDuplicate: 0, errors: 0 };
  }

  const pending = await getPendingTransactions();

  if (pending.length === 0) {
    return { saved: 0, skippedDuplicate: 0, errors: 0 };
  }

  let saved = 0;
  let skippedDuplicate = 0;
  let errors = 0;
  const succeededEntryIds: string[] = [];

  const now = toIsoDateTime(new Date());

  for (const item of pending) {
    const txId = toTransactionId(item.id);
    const amount = Math.round(item.amount);
    assertCopAmount(amount);
    const date = toIsoDate(new Date(item.createdAt));
    const fallbackCategoryId = "other";
    if (!isValidCategoryId(fallbackCategoryId)) {
      throw new Error("Missing fallback category");
    }
    const categoryId =
      item.category && isValidCategoryId(item.category) ? item.category : fallbackCategoryId;
    const type = item.type === "income" ? "income" : "expense";
    const description = item.description ?? "";

    const fingerprint = widgetFingerprint(item.id, amount, date);

    if (inFlightFingerprints.has(fingerprint)) {
      skippedDuplicate++;
      succeededEntryIds.push(item.id);
      continue;
    }

    inFlightFingerprints.add(fingerprint);

    try {
      const alreadyProcessed = await isCaptureProcessed({
        db,
        userId,
        sourceFamily: "widget",
        sourceId: "widget",
        sourceEventId: fingerprint,
      });
      if (alreadyProcessed) {
        persistProcessedSourceEvent({
          db,
          userId,
          sourceFamily: "widget",
          sourceId: "widget",
          sourceEventId: fingerprint,
          status: "processed",
          failureReason: "already_processed_duplicate",
          receivedAt: now,
          processedAt: now,
        });
        skippedDuplicate++;
        succeededEntryIds.push(item.id);
        continue;
      }

      const existingTxId = await findDuplicateTransaction({
        db,
        userId,
        amount,
        date,
        merchant: description,
      });

      if (existingTxId) {
        persistProcessedSourceEvent({
          db,
          userId,
          sourceFamily: "widget",
          sourceId: "widget",
          sourceEventId: fingerprint,
          status: "processed",
          failureReason: `duplicate:${existingTxId}`,
          receivedAt: now,
          processedAt: now,
        });

        skippedDuplicate++;
        succeededEntryIds.push(item.id);
        continue;
      }

      const defaultAccount = ensureDefaultFinancialAccount(db, userId, { now });
      const recordResult = await recordAutomatedTransactionWithLocalLedger({
        db,
        transactionId: txId,
        now,
        command: {
          userId,
          type,
          amount,
          categoryId,
          description,
          counterpartyName: description,
          occurredOn: date,
          accountId: defaultAccount.id,
          accountAttributionState: "unresolved",
          source: "automated",
        },
        afterRecord: (tx) => {
          persistCommittedCaptureSourceEventInTransaction(tx, {
            userId,
            sourceFamily: "widget",
            sourceId: "widget",
            sourceEventId: fingerprint,
            status: "processed",
            failureReason: null,
            receivedAt: now,
            processedAt: now,
            transactionId: txId,
            evidence: [],
          });
        },
      });

      if (!recordResult.success) {
        throw new Error(localLedgerRejectionReason(recordResult.error));
      }

      trackTransactionCreated({
        type,
        category: categoryId,
        source: "widget",
      });

      saved++;
      succeededEntryIds.push(item.id);
    } catch (error) {
      try {
        persistProcessedSourceEvent({
          db,
          userId,
          sourceFamily: "widget",
          sourceId: "widget",
          sourceEventId: fingerprint,
          status: "failed",
          failureReason: failureReason(error),
          receivedAt: now,
          processedAt: now,
        });
      } catch (persistError) {
        captureWarning("widget_failed_source_event_persist_failed", {
          sourceEventId: fingerprint,
          errorType: errorType(persistError),
        });
      }
      captureError(error);
      errors++;
    } finally {
      inFlightFingerprints.delete(fingerprint);
    }
  }

  if (succeededEntryIds.length > 0) {
    try {
      await removePendingTransactions(succeededEntryIds);
    } catch (error) {
      captureWarning("widget_pending_cleanup_failed", {
        succeeded: succeededEntryIds.length,
        errorType: errorType(error),
      });
      throw error;
    }
  }

  capturePipelineEvent({ source: "widget", saved, skippedDuplicate, errors });

  return { saved, skippedDuplicate, errors };
}
