import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { processedSourceEvents, reviewCandidates } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

const emailSourceEventQueueFilter = (
  userId: UserId,
  statuses: readonly ("failed" | "needs_review" | "pending_retry")[]
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
    .where(
      and(
        emailSourceEventQueueFilter(userId, ["needs_review"]),
        sql`exists (
          select 1
          from ${reviewCandidates}
          where ${reviewCandidates.processedSourceEventId} = ${processedSourceEvents.id}
            and ${reviewCandidates.userId} = ${userId}
            and ${reviewCandidates.status} = 'pending'
            and ${reviewCandidates.deletedAt} is null
        )`
      )
    )
    .orderBy(desc(processedSourceEvents.receivedAt));
}
