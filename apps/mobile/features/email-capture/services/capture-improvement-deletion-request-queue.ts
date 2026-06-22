import { eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { captureImprovementDeletionRequests } from "@/shared/db/schema";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

export type CaptureImprovementDeletionRequest = {
  readonly requestedAt: IsoDateTime;
};

export function enqueueCaptureImprovementDeletionRequest(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly requestedAt: IsoDateTime;
}): void {
  input.db
    .insert(captureImprovementDeletionRequests)
    .values({
      userId: input.userId,
      requestedAt: input.requestedAt,
      lastAttemptAt: null,
    })
    .onConflictDoNothing()
    .run();
}

export function getCaptureImprovementDeletionRequest(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
}): CaptureImprovementDeletionRequest | null {
  return (
    input.db
      .select({ requestedAt: captureImprovementDeletionRequests.requestedAt })
      .from(captureImprovementDeletionRequests)
      .where(eq(captureImprovementDeletionRequests.userId, input.userId))
      .get() ?? null
  );
}

export function markCaptureImprovementDeletionAttempt(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly lastAttemptAt: IsoDateTime;
}): void {
  input.db
    .update(captureImprovementDeletionRequests)
    .set({ lastAttemptAt: input.lastAttemptAt })
    .where(eq(captureImprovementDeletionRequests.userId, input.userId))
    .run();
}

export function clearCaptureImprovementDeletionRequest(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
}): void {
  input.db
    .delete(captureImprovementDeletionRequests)
    .where(eq(captureImprovementDeletionRequests.userId, input.userId))
    .run();
}
