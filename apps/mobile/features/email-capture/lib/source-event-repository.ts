import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { processedSourceEvents } from "@/shared/db/schema";
import type {
  IsoDateTime,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type ProcessedSourceEventRow = typeof processedSourceEvents.$inferInsert;

export async function getProcessedEmailSourceEventIds(
  db: AnyDb,
  userId: UserId,
  sourceEvents: readonly { readonly sourceId: string; readonly sourceEventId: string }[]
) {
  if (sourceEvents.length === 0) return new Set<string>();
  const sourceEventIds = sourceEvents.map((event) => event.sourceEventId);
  const requestedKeys = new Set(
    sourceEvents.map((event) => `${event.sourceId}:${event.sourceEventId}`)
  );
  const rows = await db
    .select({
      sourceId: processedSourceEvents.sourceId,
      sourceEventId: processedSourceEvents.sourceEventId,
    })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        inArray(processedSourceEvents.sourceEventId, sourceEventIds),
        isNull(processedSourceEvents.deletedAt)
      )
    );
  return new Set(
    rows.flatMap((row) => {
      const key = `${row.sourceId}:${row.sourceEventId}`;
      return requestedKeys.has(key) ? [key] : [];
    })
  );
}

export function insertProcessedEmailSourceEvent(db: AnyDb, row: ProcessedSourceEventRow) {
  db.insert(processedSourceEvents).values(row).onConflictDoNothing().run();
}

export async function getPendingRetryEmailSourceEvents(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "pending_retry"),
        lte(processedSourceEvents.nextRetryAt, sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .orderBy(asc(processedSourceEvents.nextRetryAt), asc(processedSourceEvents.receivedAt))
    .limit(50);
}

function getProcessedSourceEventUpdateQuery(
  db: AnyDb,
  id: ProcessedSourceEventId,
  fields: Partial<ProcessedSourceEventRow>
) {
  return db.update(processedSourceEvents).set(fields).where(eq(processedSourceEvents.id, id));
}

export async function markSourceEventForRetry(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly retryCount: number;
  readonly nextRetryAt: IsoDateTime;
}) {
  await getProcessedSourceEventUpdateQuery(input.db, input.id, {
    status: "pending_retry",
    retryCount: input.retryCount,
    nextRetryAt: input.nextRetryAt,
  });
}

export async function markSourceEventPermanentlyFailed(db: AnyDb, id: ProcessedSourceEventId) {
  await getProcessedSourceEventUpdateQuery(db, id, { status: "failed" });
}

export async function markSourceEventRetrySuccess(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly status: "processed" | "needs_review" | "duplicate";
  readonly transactionId: TransactionId | null;
  readonly confidence: number;
}) {
  await getProcessedSourceEventUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
    confidence: input.confidence,
  });
}

export async function updateProcessedSourceEventStatus(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
}) {
  await getProcessedSourceEventUpdateQuery(input.db, input.id, {
    status: input.status,
    transactionId: input.transactionId,
  });
}
export function updateProcessedSourceEventStatusInTransaction(input: {
  readonly db: AnyDb;
  readonly id: ProcessedSourceEventId;
  readonly userId: UserId;
  readonly status: string;
  readonly transactionId: TransactionId | null;
  readonly updatedAt: IsoDateTime;
}) {
  const update = input.db
    .update(processedSourceEvents)
    .set({
      status: input.status,
      transactionId: input.transactionId,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(processedSourceEvents.id, input.id),
        eq(processedSourceEvents.userId, input.userId),
        eq(processedSourceEvents.sourceFamily, "email"),
        eq(processedSourceEvents.status, "needs_review"),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .run();

  if (update.changes !== 1) {
    throw new Error("Processed source event reclassification target was not found");
  }
}
