import { addDays } from "date-fns";
import { and, count, eq, gte, isNull, lt } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { detectedSmsEvents, notificationSources, processedSourceEvents } from "@/shared/db/schema";
import { toIsoDate } from "@/shared/lib/format-date";
import { generateNotificationSourceId } from "@/shared/lib/generate-id";
import { requireIsoDateTime } from "@/shared/types/assertions";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

// -- notificationSources CRUD --

export async function getEnabledPackages(db: AnyDb, userId: UserId): Promise<string[]> {
  const rows = await db
    .select({ packageName: notificationSources.packageName })
    .from(notificationSources)
    .where(and(eq(notificationSources.userId, userId), eq(notificationSources.isEnabled, true)));
  return rows.map((r) => r.packageName);
}

export async function upsertNotificationSource(
  db: AnyDb,
  userId: UserId,
  packageName: string,
  label: string,
  isEnabled: boolean,
  now: IsoDateTime
) {
  await db
    .insert(notificationSources)
    .values({
      id: generateNotificationSourceId(),
      userId,
      packageName,
      label,
      isEnabled,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [notificationSources.userId, notificationSources.packageName],
      set: { isEnabled, label },
    });
}

// -- processedSourceEvents reads --

export async function hasProcessedSourceEventsBySource(
  db: AnyDb,
  userId: UserId,
  source: string
): Promise<boolean> {
  const rows = await db
    .select({ id: processedSourceEvents.id })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, userId),
        eq(processedSourceEvents.sourceFamily, source),
        isNull(processedSourceEvents.deletedAt)
      )
    )
    .limit(1);
  return rows.length > 0;
}

// -- detectedSmsEvents CRUD --

export type DetectedSmsEventRow = typeof detectedSmsEvents.$inferInsert;

export async function insertDetectedSmsEvent(db: AnyDb, row: DetectedSmsEventRow) {
  await db.insert(detectedSmsEvents).values(row);
}

export async function getTodaySmsEventCount(db: AnyDb, userId: UserId, now: Date): Promise<number> {
  const today = toIsoDate(now);
  const tomorrow = toIsoDate(addDays(now, 1));
  const todayStart = requireIsoDateTime(`${today}T00:00:00.000Z`);
  const tomorrowStart = requireIsoDateTime(`${tomorrow}T00:00:00.000Z`);
  const rows = await db
    .select({ total: count() })
    .from(detectedSmsEvents)
    .where(
      and(
        eq(detectedSmsEvents.userId, userId),
        eq(detectedSmsEvents.dismissed, false),
        gte(detectedSmsEvents.detectedAt, todayStart),
        lt(detectedSmsEvents.detectedAt, tomorrowStart)
      )
    );
  return rows[0]?.total ?? 0;
}
