import type { AnyDb } from "@/shared/db";
import { captureError, captureWarning } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { isEmailCaptureDebugEnabled } from "./email-capture-debug";
import type { EmailParseImprovementRequest } from "./email-pipeline-service/types";
import {
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

export async function shareEmailParseImprovementRequests(input: {
  readonly db: AnyDb;
  readonly enabled: boolean;
  readonly userId: UserId;
  readonly requests: readonly EmailParseImprovementRequest[];
  readonly isSharingEnabled?: () => boolean;
}): Promise<void> {
  if (!input.enabled) {
    logParseImprovementSharingForDebug({
      enabled: false,
      requestCount: input.requests.length,
      enqueued: 0,
      shared: 0,
      failed: 0,
    });
    return;
  }

  if (input.isSharingEnabled && !input.isSharingEnabled()) {
    logParseImprovementSharingForDebug({
      enabled: false,
      requestCount: input.requests.length,
      enqueued: 0,
      shared: 0,
      failed: 0,
    });
    return;
  }

  const enqueueRequest = (request: EmailParseImprovementRequest): number => {
    try {
      return enqueueEmailParseImprovementRequests({
        db: input.db,
        userId: input.userId,
        requests: [request],
      });
    } catch (error) {
      captureError(error);
      captureWarning("email_parse_improvement_sample_enqueue_failed", {
        errorType: getErrorName(error),
      });
      return 0;
    }
  };
  const enqueued = input.requests.reduce((total, request) => total + enqueueRequest(request), 0);

  const result = await flushPendingEmailParseImprovementSamples({
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
