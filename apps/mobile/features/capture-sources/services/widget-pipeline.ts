import { insertTransaction } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  captureError,
  capturePipelineEvent,
  generateSyncQueueId,
  generateTransactionId,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import type { CategoryId, CopAmount, UserId } from "@/shared/types/branded";

// Dynamic import to avoid Android bundle crash — this module calls
// requireNativeModule("ExpoAppIntents") which only exists on iOS.
const loadAppIntents = () =>
  import("@/modules/expo-app-intents") as Promise<typeof import("@/modules/expo-app-intents")>;

// Guard against concurrent invocations (mount + immediate AppState "active").
let processing = false;

export async function processWidgetTransactions(db: AnyDb, userId: UserId): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const mod = await loadAppIntents();

    if (!mod.isAvailable()) return;

    const pending = await mod.getPendingTransactions();
    if (pending.length === 0) return;

    await Promise.all(
      pending.map(async (item) => {
        const txId = generateTransactionId();
        const now = toIsoDateTime(new Date());
        const amount = Math.round(item.amount) as CopAmount;
        const date = toIsoDate(new Date(item.createdAt));

        await insertTransaction(db, {
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
      })
    );

    await mod.clearPendingTransactions();

    capturePipelineEvent({ source: "widget", saved: pending.length, skippedDuplicate: 0 });
  } catch (error) {
    captureError(error);
  } finally {
    processing = false;
  }
}
