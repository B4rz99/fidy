import { upsertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  generateSyncQueueId,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import type { CategoryId, CopAmount, TransactionId, UserId } from "@/shared/types/branded";

// Dynamic import to avoid Android bundle crash — this module calls
// requireNativeModule("ExpoAppIntents") which only exists on iOS.
const loadAppIntents = () =>
  import("@/modules/expo-app-intents") as Promise<typeof import("@/modules/expo-app-intents")>;

// Guard against concurrent invocations (mount + immediate AppState "active").
let processing = false;

/** Derive a deterministic TransactionId from the widget entry UUID for idempotent retries. */
const toTransactionId = (widgetEntryId: string): TransactionId =>
  `txn-widget-${widgetEntryId}` as TransactionId;

export async function processWidgetTransactions(db: AnyDb, userId: UserId): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const mod = await loadAppIntents();

    if (!mod.isAvailable()) return;

    const pending = await mod.getPendingTransactions();
    if (pending.length === 0) return;

    const processedIds: string[] = [];

    await Promise.all(
      pending.map(async (item) => {
        const txId = toTransactionId(item.id);
        const now = toIsoDateTime(new Date());
        const amount = Math.round(item.amount) as CopAmount;
        const date = toIsoDate(new Date(item.createdAt));

        upsertTransaction(db, {
          id: txId,
          userId,
          type: "expense",
          amount,
          categoryId: "other" as CategoryId,
          description: "",
          date,
          source: "widget",
          createdAt: now,
          updatedAt: now,
        });

        await enqueueSync(db, {
          id: generateSyncQueueId(),
          tableName: "transactions",
          rowId: txId,
          operation: "insert",
          createdAt: now,
        });

        trackTransactionCreated({
          type: "expense",
          category: "other",
          source: "widget",
        });

        processedIds.push(item.id);
      })
    );

    await mod.removePendingTransactions(processedIds);

    capturePipelineEvent({ source: "widget", saved: processedIds.length, skippedDuplicate: 0 });
  } catch (error) {
    captureError(error);
  } finally {
    processing = false;
  }
}
