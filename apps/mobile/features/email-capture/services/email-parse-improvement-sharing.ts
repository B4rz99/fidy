import type { AnyDb } from "@/shared/db";
import { captureError, captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { isEmailCaptureDebugEnabled } from "./email-capture-debug";
import type { EmailParseImprovementRequest } from "./email-pipeline-service/types";
import {
  deleteEmailParseImprovementSamplesForUser,
  enqueueEmailParseImprovementRequests,
  flushPendingEmailParseImprovementSamples,
} from "./email-parse-improvement-outbox";

const getErrorName = (error: unknown): string => (error instanceof Error ? error.name : "unknown");

const logParseImprovementSharingForDebug = (input: {
  readonly enabled: boolean;
  readonly requestCount: number;
  readonly enqueued: number;
  readonly shared: number;
  readonly failed: number;
}): void => {
  if (!isEmailCaptureDebugEnabled()) return;

  // eslint-disable-next-line no-console
  console.log("[email-capture] parse-improvement.summary", input);
};

const logDisabledParseImprovementSharing = (requestCount: number): void => {
  logParseImprovementSharingForDebug({
    enabled: false,
    requestCount,
    enqueued: 0,
    shared: 0,
    failed: 0,
  });
};

const retryDisabledParseImprovementDeletion = (input: {
  readonly db: AnyDb;
  readonly userId: UserId;
}) =>
  deleteEmailParseImprovementSamplesForUser(input).catch((error) => {
    captureError(error);
    captureWarning("email_parse_improvement_sample_delete_failed", {
      errorType: getErrorName(error),
    });
    return { deleted: 0 };
  });

const shouldShareParseImprovements = (input: {
  readonly enabled: boolean;
  readonly isSharingEnabled?: () => boolean;
}): boolean => input.enabled && (!input.isSharingEnabled || input.isSharingEnabled());

const enqueueParseImprovementRequest = (input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly request: EmailParseImprovementRequest;
}): number => {
  try {
    return enqueueEmailParseImprovementRequests({
      db: input.db,
      userId: input.userId,
      requests: [input.request],
    });
  } catch (error) {
    captureError(error);
    captureWarning("email_parse_improvement_sample_enqueue_failed", {
      errorType: getErrorName(error),
    });
    return 0;
  }
};

const flushParseImprovementRequests = (input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly isSharingEnabled?: () => boolean;
}) =>
  flushPendingEmailParseImprovementSamples({
    db: input.db,
    userId: input.userId,
    ...(input.isSharingEnabled ? { isSharingEnabled: input.isSharingEnabled } : {}),
  }).catch((error) => {
    captureError(error);
    captureWarning("email_parse_improvement_sample_share_failed", {
      errorType: getErrorName(error),
    });
    return { shared: 0, failed: 0, warningCaptured: true };
  });

export async function shareEmailParseImprovementRequests(input: {
  readonly db: AnyDb;
  readonly enabled: boolean;
  readonly userId: UserId;
  readonly requests: readonly EmailParseImprovementRequest[];
  readonly isSharingEnabled?: () => boolean;
}): Promise<void> {
  if (!shouldShareParseImprovements(input)) {
    await retryDisabledParseImprovementDeletion({ db: input.db, userId: input.userId });
    logDisabledParseImprovementSharing(input.requests.length);
    return;
  }

  const enqueued = input.requests.reduce(
    (total, request) => total + enqueueParseImprovementRequest({ ...input, request }),
    0
  );

  const result = await flushParseImprovementRequests(input);
  if (result.failed > 0 && !("warningCaptured" in result)) {
    captureWarning("email_parse_improvement_sample_share_failed", {
      errorType: result.failureTypes?.join(",") ?? "unknown",
    });
  }

  logParseImprovementSharingForDebug({
    enabled: true,
    requestCount: input.requests.length,
    enqueued,
    shared: result.shared,
    failed: result.failed,
  });
}
