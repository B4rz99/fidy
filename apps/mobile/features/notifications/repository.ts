import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { notifications } from "@/shared/db/schema";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

export type NotificationRow = typeof notifications.$inferInsert;

export function insertNotification(db: AnyDb, row: NotificationRow): { changes: number } {
  return db.insert(notifications).values(row).onConflictDoNothing().run();
}

export function getNotifications(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
    .all();
}

export function countNotificationsSince(
  db: AnyDb,
  userId: UserId,
  since: IsoDateTime | null
): number {
  if (since === null) {
    return 0;
  }

  const result = db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        gt(notifications.createdAt, since),
        isNull(notifications.deletedAt)
      )
    )
    .get();

  return result?.count ?? 0;
}
