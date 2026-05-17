import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { ProcessedSourceEventRow } from "../lib/repository";
import { getFailedEmailSourceEvents, getNeedsReviewEmailSourceEvents } from "../lib/repository";

export type EmailCaptureQueues = {
  readonly failedEmailSourceEvents: readonly ProcessedSourceEventRow[];
  readonly needsReviewEmailSourceEvents: readonly ProcessedSourceEventRow[];
};

export async function loadEmailCaptureQueues(
  db: AnyDb,
  userId: UserId
): Promise<EmailCaptureQueues> {
  const [failedEmailSourceEvents, needsReviewEmailSourceEvents] = await Promise.all([
    getFailedEmailSourceEvents(db, userId),
    getNeedsReviewEmailSourceEvents(db, userId),
  ]);

  return {
    failedEmailSourceEvents,
    needsReviewEmailSourceEvents,
  };
}
