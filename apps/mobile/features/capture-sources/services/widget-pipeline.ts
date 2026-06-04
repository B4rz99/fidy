import { isValidCategoryId } from "@/features/transactions/write.public";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/public";
import {
  recordCommittedCaptureSourceEventInTransactionWithLocalLedger,
  recordProcessedCaptureSourceEventWithLocalLedger,
} from "@/infrastructure/local-ledger/public";
import type { PendingWidgetTransaction } from "@/modules/expo-app-intents";
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
import type { CategoryId, IsoDateTime, TransactionId, UserId } from "@/shared/types/branded";
import { captureFingerprint, isCaptureProcessed } from "../lib/dedup";

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

const userAuthoredWidgetDescription = (description: string | undefined): string =>
  description ?? "";
const widgetCounterpartyName = (): string => "";

type ProcessWidgetEntryResult = "saved" | "duplicate" | "in_flight" | "failed";

function resolveWidgetCategoryId(category: string | undefined): CategoryId {
  const fallbackCategoryId = "other";
  if (!isValidCategoryId(fallbackCategoryId)) {
    throw new Error("Missing fallback category");
  }
  return category && isValidCategoryId(category) ? category : fallbackCategoryId;
}

function persistFailedWidgetEvent(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly fingerprint: string;
  readonly now: IsoDateTime;
  readonly error: unknown;
}) {
  try {
    recordProcessedCaptureSourceEventWithLocalLedger({
      db: input.db,
      userId: input.userId,
      sourceFamily: "widget",
      sourceId: "widget",
      sourceEventId: input.fingerprint,
      status: "failed",
      failureReason: failureReason(input.error),
      receivedAt: input.now,
      processedAt: input.now,
    });
  } catch (persistError) {
    captureWarning("widget_failed_source_event_persist_failed", {
      sourceEventId: input.fingerprint,
      errorType: errorType(persistError),
    });
  }
}

async function processWidgetEntry(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly item: PendingWidgetTransaction;
  readonly now: IsoDateTime;
}): Promise<ProcessWidgetEntryResult> {
  const { db, userId, item, now } = input;
  const txId = toTransactionId(item.id);
  const amount = Math.round(item.amount);
  assertCopAmount(amount);
  const date = toIsoDate(new Date(item.createdAt));
  const categoryId = resolveWidgetCategoryId(item.category);
  const type = item.type === "income" ? "income" : "expense";
  const description = userAuthoredWidgetDescription(item.description);
  const counterpartyName = widgetCounterpartyName();
  const fingerprint = widgetFingerprint(item.id, amount, date);

  if (inFlightFingerprints.has(fingerprint)) return "in_flight";

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
      recordProcessedCaptureSourceEventWithLocalLedger({
        db,
        userId,
        sourceFamily: "widget",
        sourceId: "widget",
        sourceEventId: fingerprint,
        status: "duplicate",
        failureReason: null,
        receivedAt: now,
        processedAt: now,
      });
      return "duplicate";
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
        counterpartyName,
        occurredOn: date,
        accountId: defaultAccount.id,
        accountAttributionState: "unresolved",
        source: "widget_capture",
      },
      afterRecord: (tx) => {
        recordCommittedCaptureSourceEventInTransactionWithLocalLedger(tx, {
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

    trackTransactionCreated({ type, category: categoryId, source: "widget" });
    return "saved";
  } catch (error) {
    persistFailedWidgetEvent({ db, userId, fingerprint, now, error });
    captureError(error);
    return "failed";
  } finally {
    inFlightFingerprints.delete(fingerprint);
  }
}

async function cleanupSucceededWidgetEntries(
  removePendingTransactions: (ids: string[]) => Promise<void>,
  succeededEntryIds: readonly string[]
) {
  if (succeededEntryIds.length === 0) return;

  try {
    await removePendingTransactions([...succeededEntryIds]);
  } catch (error) {
    captureWarning("widget_pending_cleanup_failed", {
      succeeded: succeededEntryIds.length,
      errorType: errorType(error),
    });
    throw error;
  }
}

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
    const result = await processWidgetEntry({ db, userId, item, now });
    if (result === "saved") {
      saved += 1;
      succeededEntryIds.push(item.id);
    } else if (result === "duplicate") {
      skippedDuplicate += 1;
      succeededEntryIds.push(item.id);
    } else if (result === "in_flight") {
      skippedDuplicate += 1;
    } else {
      errors += 1;
    }
  }

  await cleanupSucceededWidgetEntries(removePendingTransactions, succeededEntryIds);

  capturePipelineEvent({ source: "widget", saved, skippedDuplicate, errors });

  return { saved, skippedDuplicate, errors };
}
