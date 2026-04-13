import type { ApplePayIntentData, NotificationData } from "@/features/capture-sources/schema";
import type { RawEmail } from "@/features/email-capture/schema";
import type {
  PipelineResult,
  ProgressCallback,
  RetryResult,
} from "@/features/email-capture/services/email-pipeline";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

type NotificationHandler =
  typeof import("@/features/capture-sources/services/notification-pipeline").processNotification;
type ApplePayHandler =
  typeof import("@/features/capture-sources/services/apple-pay-pipeline").processApplePayIntent;
type WidgetHandler =
  typeof import("@/features/capture-sources/services/widget-pipeline").processWidgetTransactions;
type EmailBatchHandler =
  typeof import("@/features/email-capture/services/email-pipeline").processEmails;
type EmailRetryHandler =
  typeof import("@/features/email-capture/services/email-pipeline").processRetries;

export type CaptureIngestionCommand =
  | { kind: "notification"; userId: UserId; notification: NotificationData }
  | { kind: "apple_pay"; userId: UserId; intent: ApplePayIntentData }
  | { kind: "widget"; userId: UserId }
  | { kind: "email_batch"; userId: UserId; emails: RawEmail[]; onProgress?: ProgressCallback }
  | { kind: "email_retry"; userId: UserId };

type CaptureIngestionDeps = {
  processNotification: NotificationHandler;
  processApplePayIntent: ApplePayHandler;
  processWidgetTransactions: WidgetHandler;
  processEmails: EmailBatchHandler;
  processRetries: EmailRetryHandler;
};

export type CaptureIngestionOutcome =
  | Awaited<ReturnType<NotificationHandler>>
  | Awaited<ReturnType<ApplePayHandler>>
  | Awaited<ReturnType<WidgetHandler>>
  | PipelineResult
  | RetryResult;

export interface CaptureIngestionPort {
  ingest(command: CaptureIngestionCommand): Promise<CaptureIngestionOutcome>;
}

type DefaultDeps = CaptureIngestionDeps;

let defaultDepsPromise: Promise<DefaultDeps> | null = null;

async function loadDefaultDeps(): Promise<DefaultDeps> {
  if (defaultDepsPromise) return defaultDepsPromise;

  defaultDepsPromise = (async () => {
    const [notification, applePay, widget, email] = await Promise.all([
      import("@/features/capture-sources/services/notification-pipeline"),
      import("@/features/capture-sources/services/apple-pay-pipeline"),
      import("@/features/capture-sources/services/widget-pipeline"),
      import("@/features/email-capture/services/email-pipeline"),
    ]);

    return {
      processNotification: notification.processNotification,
      processApplePayIntent: applePay.processApplePayIntent,
      processWidgetTransactions: widget.processWidgetTransactions,
      processEmails: email.processEmails,
      processRetries: email.processRetries,
    };
  })();

  return defaultDepsPromise;
}

export function createCaptureIngestionPort(
  db: AnyDb,
  deps: Partial<CaptureIngestionDeps> = {}
): CaptureIngestionPort {
  return {
    async ingest(command) {
      switch (command.kind) {
        case "notification":
          return (deps.processNotification ?? (await loadDefaultDeps()).processNotification)(
            db,
            command.userId,
            command.notification
          );
        case "apple_pay":
          return (deps.processApplePayIntent ?? (await loadDefaultDeps()).processApplePayIntent)(
            db,
            command.userId,
            command.intent
          );
        case "widget":
          return (
            deps.processWidgetTransactions ?? (await loadDefaultDeps()).processWidgetTransactions
          )(db, command.userId);
        case "email_batch":
          return (deps.processEmails ?? (await loadDefaultDeps()).processEmails)(
            db,
            command.userId,
            command.emails,
            command.onProgress
          );
        case "email_retry":
          return (deps.processRetries ?? (await loadDefaultDeps()).processRetries)(
            db,
            command.userId
          );
      }
    },
  };
}
