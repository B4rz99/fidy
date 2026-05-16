import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { ProcessedEmailRow, ProcessedSourceEventRow } from "../lib/repository";
import {
  getFailedEmailSourceEvents,
  getFailedEmails,
  getNeedsReviewEmailSourceEvents,
  getNeedsReviewEmails,
} from "../lib/repository";

export type EmailCaptureQueues = {
  readonly failedEmails: readonly ProcessedEmailRow[];
  readonly failedEmailSourceEvents: readonly ProcessedSourceEventRow[];
  readonly needsReviewEmails: readonly ProcessedEmailRow[];
  readonly needsReviewEmailSourceEvents: readonly ProcessedSourceEventRow[];
};

export async function loadEmailCaptureQueues(
  db: AnyDb,
  userId: UserId
): Promise<EmailCaptureQueues> {
  const [failedEmails, failedEmailSourceEvents, needsReviewEmails, needsReviewEmailSourceEvents] =
    await Promise.all([
      getFailedEmails(db),
      getFailedEmailSourceEvents(db, userId),
      getNeedsReviewEmails(db),
      getNeedsReviewEmailSourceEvents(db, userId),
    ]);

  return {
    failedEmails,
    failedEmailSourceEvents,
    needsReviewEmails,
    needsReviewEmailSourceEvents,
  };
}
