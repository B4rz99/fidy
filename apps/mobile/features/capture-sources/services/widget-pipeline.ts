import { insertTransaction, isValidCategoryId } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  generateProcessedCaptureId,
  generateSyncQueueId,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import type { CategoryId, CopAmount, IsoDate, TransactionId, UserId } from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import { insertProcessedCapture } from "../lib/repository";

// Guard against concurrent invocations (mount + immediate AppState "active").
const inFlightFingerprints = new Set<string>();

function toTransactionId(widgetEntryId: string): TransactionId {
  return `txn-widget-${widgetEntryId}` as TransactionId;
}

function widgetFingerprint(entryId: string, amount: number, date: string): string {
  return captureFingerprint("widget", amount, date, entryId);
}

export type WidgetPipelineResult = {
  saved: number;
  skippedDuplicate: number;
  errors: number;
};

export async function processWidgetTransactions(
  db: AnyDb,
  userId: UserId
): Promise<WidgetPipelineResult> {
  console.log("[WidgetPipeline] Starting processWidgetTransactions");

  const { isAvailable, getPendingTransactions, removePendingTransactions } = await import(
    "@/modules/expo-app-intents"
  );

  if (!isAvailable()) {
    console.log("[WidgetPipeline] Module not available (likely Android)");
    return { saved: 0, skippedDuplicate: 0, errors: 0 };
  }

  console.log("[WidgetPipeline] Calling getPendingTransactions...");
  const pending = await getPendingTransactions();
  console.log(`[WidgetPipeline] Found ${pending.length} pending transactions`);

  if (pending.length === 0) {
    console.log("[WidgetPipeline] No pending transactions to process");
    return { saved: 0, skippedDuplicate: 0, errors: 0 };
  }

  let saved = 0;
  let skippedDuplicate = 0;
  let errors = 0;
  const succeededEntryIds: string[] = [];

  const now = toIsoDateTime(new Date());

  for (const item of pending) {
    const txId = toTransactionId(item.id);
    const amount = Math.round(item.amount) as CopAmount;
    const date = toIsoDate(new Date(item.createdAt)) as IsoDate;
    const categoryId = (
      item.category && isValidCategoryId(item.category) ? item.category : "other"
    ) as CategoryId;
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
      const alreadyProcessed = await isCaptureProcessed(db, fingerprint);
      if (alreadyProcessed) {
        skippedDuplicate++;
        succeededEntryIds.push(item.id);
        continue;
      }

      const existingTxId = await findDuplicateTransaction(db, userId, amount, date, description);

      if (existingTxId) {
        await insertProcessedCapture(db, {
          id: generateProcessedCaptureId(),
          fingerprintHash: fingerprint,
          source: "widget",
          status: "skipped_duplicate",
          rawText: description,
          transactionId: existingTxId as TransactionId,
          confidence: null,
          receivedAt: now,
          createdAt: now,
        });

        skippedDuplicate++;
        succeededEntryIds.push(item.id);
        continue;
      }

      insertTransaction(db, {
        id: txId,
        userId,
        type,
        amount,
        categoryId,
        description,
        date,
        source: "widget",
        createdAt: now,
        updatedAt: now,
      });

      enqueueSync(db, {
        id: generateSyncQueueId(),
        tableName: "transactions",
        rowId: txId,
        operation: "insert",
        createdAt: now,
      });

      await insertProcessedCapture(db, {
        id: generateProcessedCaptureId(),
        fingerprintHash: fingerprint,
        source: "widget",
        status: "success",
        rawText: description,
        transactionId: txId,
        confidence: null,
        receivedAt: now,
        createdAt: now,
      });

      trackTransactionCreated({
        type,
        category: categoryId,
        source: "widget",
      });

      saved++;
      succeededEntryIds.push(item.id);
    } catch (error) {
      captureError(error);
      errors++;
    } finally {
      inFlightFingerprints.delete(fingerprint);
    }
  }

  if (succeededEntryIds.length > 0) {
    await removePendingTransactions(succeededEntryIds);
  }

  capturePipelineEvent({ source: "widget", saved, skippedDuplicate });

  return { saved, skippedDuplicate, errors };
}
