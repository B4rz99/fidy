import { addDays } from "date-fns";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { detectedSmsEvents, notificationSources, processedCaptures } from "@/shared/db";
import { generateNotificationSourceId, toIsoDate } from "@/shared/lib";
import type { DetectedSmsEventId, IsoDate, IsoDateTime, UserId } from "@/shared/types/branded";

// -- notificationSources CRUD --

export type NotificationSourceRow = typeof notificationSources.$inferInsert;

export async function getNotificationSources(db: AnyDb, userId: string) {
  return db
    .select()
    .from(notificationSources)
    .where(eq(notificationSources.userId, userId as UserId));
}

export async function getEnabledPackages(db: AnyDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ packageName: notificationSources.packageName })
    .from(notificationSources)
    .where(
      and(eq(notificationSources.userId, userId as UserId), eq(notificationSources.isEnabled, true))
    );
  return rows.map((r) => r.packageName);
}

export async function upsertNotificationSource(
  db: AnyDb,
  userId: string,
  packageName: string,
  label: string,
  isEnabled: boolean,
  now: string
) {
  await db
    .insert(notificationSources)
    .values({
      id: generateNotificationSourceId(),
      userId: userId as UserId,
      packageName,
      label,
      isEnabled,
      createdAt: now as IsoDateTime,
    })
    .onConflictDoUpdate({
      target: [notificationSources.userId, notificationSources.packageName],
      set: { isEnabled, label },
    });
}

// -- processedCaptures CRUD --

export type ProcessedCaptureRow = typeof processedCaptures.$inferInsert;

export async function insertProcessedCapture(db: AnyDb, row: ProcessedCaptureRow) {
  await db.insert(processedCaptures).values(row).onConflictDoNothing();
}

export async function getProcessedCapturesBySource(db: AnyDb, source: string) {
  return db
    .select()
    .from(processedCaptures)
    .where(eq(processedCaptures.source, source))
    .orderBy(desc(processedCaptures.receivedAt));
}

export async function hasProcessedCaptures(db: AnyDb, source: string): Promise<boolean> {
  const rows = await db
    .select({ id: processedCaptures.id })
    .from(processedCaptures)
    .where(eq(processedCaptures.source, source))
    .limit(1);
  return rows.length > 0;
}

// -- detectedSmsEvents CRUD --

export type DetectedSmsEventRow = typeof detectedSmsEvents.$inferInsert;

export async function insertDetectedSmsEvent(db: AnyDb, row: DetectedSmsEventRow) {
  await db.insert(detectedSmsEvents).values(row);
}

export async function getUndismissedSmsEvents(db: AnyDb, userId: string) {
  return db
    .select()
    .from(detectedSmsEvents)
    .where(
      and(eq(detectedSmsEvents.userId, userId as UserId), eq(detectedSmsEvents.dismissed, false))
    )
    .orderBy(desc(detectedSmsEvents.detectedAt));
}

export async function getTodaySmsEventCount(db: AnyDb, userId: string, now: Date): Promise<number> {
  const today = toIsoDate(now);
  const tomorrow = toIsoDate(addDays(now, 1));
  const todayStart = `${today}T00:00:00.000Z` as IsoDateTime;
  const tomorrowStart = `${tomorrow}T00:00:00.000Z` as IsoDateTime;
  const rows = await db
    .select({ total: count() })
    .from(detectedSmsEvents)
    .where(
      and(
        eq(detectedSmsEvents.userId, userId as UserId),
        eq(detectedSmsEvents.dismissed, false),
        gte(detectedSmsEvents.detectedAt, todayStart),
        lt(detectedSmsEvents.detectedAt, tomorrowStart)
      )
    );
  return rows[0]?.total ?? 0;
}

export async function dismissSmsEvent(db: AnyDb, id: string) {
  await db
    .update(detectedSmsEvents)
    .set({ dismissed: true })
    .where(eq(detectedSmsEvents.id, id as DetectedSmsEventId));
}

export async function linkSmsEventToTransaction(db: AnyDb, id: string, transactionId: string) {
  await db
    .update(detectedSmsEvents)
    .set({
      linkedTransactionId: transactionId as import("@/shared/types/branded").TransactionId,
      dismissed: true,
    })
    .where(eq(detectedSmsEvents.id, id as DetectedSmsEventId));
}
