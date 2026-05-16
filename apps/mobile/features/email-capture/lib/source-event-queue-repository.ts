import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { processedSourceEvents } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

const emailSourceEventQueueFilter = (
  userId: UserId,
  statuses: readonly ("failed" | "needs_review")[]
) =>
  and(
    eq(processedSourceEvents.userId, userId),
    eq(processedSourceEvents.sourceFamily, "email"),
    inArray(processedSourceEvents.status, statuses),
    isNull(processedSourceEvents.deletedAt)
  );

export async function getFailedEmailSourceEvents(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(processedSourceEvents)
    .where(emailSourceEventQueueFilter(userId, ["failed"]))
    .orderBy(desc(processedSourceEvents.receivedAt));
}

export async function getNeedsReviewEmailSourceEvents(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(processedSourceEvents)
    .where(emailSourceEventQueueFilter(userId, ["needs_review"]))
    .orderBy(desc(processedSourceEvents.receivedAt));
}
