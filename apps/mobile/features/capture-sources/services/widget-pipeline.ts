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

type PendingWidgetTransaction = {
  id: string;
  amount: number;
  createdAt: string;
  category?: string;
  type?: string;
  description?: string;
};

type AppIntentsModule = {
  isAvailable: () => boolean;
  getPendingTransactions: () => Promise<PendingWidgetTransaction[]>;
  removePendingTransactions: (ids: string[]) => Promise<void>;
};

// Dynamic import to avoid Android bundle crash — this module calls
// requireNativeModule("ExpoAppIntents") which only exists on iOS.
const loadAppIntents = (): Promise<AppIntentsModule> =>
  import("@/modules/expo-app-intents") as unknown as Promise<AppIntentsModule>;

// Guard against concurrent invocations (mount + immediate AppState "active").
const inFlightFingerprints = new Set<string>();

/** Derive a deterministic TransactionId from the widget entry UUID for idempotent retries. */
const toTransactionId = (widgetEntryId: string): TransactionId =>
  `txn-widget-${widgetEntryId}` as TransactionId;

/** Build a fingerprint combining the widget entry's unique ID with source and amount. */
const widgetFingerprint = (entryId: string, amount: number, date: string): string =>
  captureFingerprint("widget", amount, date, entryId);

export type WidgetPipelineResult = {
  saved: number;
  skippedDuplicate: number;
  errors: number;
};

export async function processWidgetTransactions(
  db: AnyDb,
  userId: UserId
): Promise<WidgetPipelineResult> {
  const mod = await loadAppIntents();

  if (!mod.isAvailable()) return { saved: 0, skippedDuplicate: 0, errors: 0 };

  const pending = await mod.getPendingTransactions();
  if (pending.length === 0) return { saved: 0, skippedDuplicate: 0, errors: 0 };

  let saved = 0;
  let skippedDuplicate = 0;
  let errors = 0;
  const succeededEntryIds: string[] = [];

  const now = toIsoDateTime(new Date());

  for (const item of pending) {
    try {
      const txId = toTransactionId(item.id);
      const amount = Math.round(item.amount) as CopAmount;
      const date = toIsoDate(new Date(item.createdAt)) as IsoDate;
      const categoryId = (
        item.category && isValidCategoryId(item.category) ? item.category : "other"
      ) as CategoryId;
      const type = item.type === "income" ? "income" : "expense";
      const description = item.description ?? "";

      // Check fingerprint dedup — prevents concurrent + re-processed entries
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

        // Cross-source dedup
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
      } finally {
        inFlightFingerprints.delete(fingerprint);
      }
    } catch (error) {
      captureError(error);
      errors++;
    }
  }

  // Remove only the entries we successfully processed or skipped as duplicates
  if (succeededEntryIds.length > 0) {
    await mod.removePendingTransactions(succeededEntryIds);
  }

  capturePipelineEvent({ source: "widget", saved, skippedDuplicate });

  return { saved, skippedDuplicate, errors };
}
