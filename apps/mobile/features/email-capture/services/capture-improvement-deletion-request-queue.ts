import { eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import {
  captureImprovementDeletionConfirmations,
  captureImprovementDeletionRequests,
} from "@/shared/db/schema";
import type { IsoDateTime, UserId } from "@/shared/types/branded";

export type CaptureImprovementDeletionRequest = {
  readonly requestedAt: IsoDateTime;
};

export type CaptureImprovementDeletionConfirmation = {
  readonly confirmedAt: IsoDateTime;
};

export function enqueueCaptureImprovementDeletionRequest(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly requestedAt: IsoDateTime;
}): void {
  input.db
    .delete(captureImprovementDeletionConfirmations)
    .where(eq(captureImprovementDeletionConfirmations.userId, input.userId))
    .run();
  input.db
    .insert(captureImprovementDeletionRequests)
    .values({
      userId: input.userId,
      requestedAt: input.requestedAt,
      lastAttemptAt: null,
    })
    .onConflictDoUpdate({
      target: captureImprovementDeletionRequests.userId,
      set: {
        requestedAt: input.requestedAt,
        lastAttemptAt: null,
      },
    })
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

export function getCaptureImprovementDeletionConfirmation(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
}): CaptureImprovementDeletionConfirmation | null {
  return (
    input.db
      .select({ confirmedAt: captureImprovementDeletionConfirmations.confirmedAt })
      .from(captureImprovementDeletionConfirmations)
      .where(eq(captureImprovementDeletionConfirmations.userId, input.userId))
      .get() ?? null
  );
}

export function markCaptureImprovementDeletionConfirmed(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly confirmedAt: IsoDateTime;
}): void {
  input.db
    .insert(captureImprovementDeletionConfirmations)
    .values({
      userId: input.userId,
      confirmedAt: input.confirmedAt,
    })
    .onConflictDoUpdate({
      target: captureImprovementDeletionConfirmations.userId,
      set: {
        confirmedAt: input.confirmedAt,
      },
    })
    .run();
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
