import type {
  PipelineResult,
  ProcessEmails,
  ProcessRetries,
} from "@/features/email-capture/pipeline.public";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { ApplePayIntentData, NotificationData } from "../schema";
import type { ApplePayPipelineResult } from "./apple-pay-pipeline";
import type { NotificationPipelineResult } from "./notification-pipeline";
import type { WidgetPipelineResult } from "./widget-pipeline";

type NotificationHandler = (
  db: AnyDb,
  userId: UserId,
  notification: NotificationData
) => Promise<NotificationPipelineResult>;
type ApplePayHandler = (
  db: AnyDb,
  userId: UserId,
  intent: ApplePayIntentData
) => Promise<ApplePayPipelineResult>;
type WidgetHandler = (db: AnyDb, userId: UserId) => Promise<WidgetPipelineResult>;
type EmailBatchHandler = ProcessEmails;
type EmailRetryHandler = ProcessRetries;

export type CaptureIngestionCommand =
  | { kind: "notification"; userId: UserId; notification: NotificationData }
  | { kind: "apple_pay"; userId: UserId; intent: ApplePayIntentData }
  | { kind: "widget"; userId: UserId };

export type EmailCaptureIngestionCommand =
  | {
      kind: "email_batch";
      userId: UserId;
      emails: Parameters<ProcessEmails>[2];
      onProgress?: Parameters<ProcessEmails>[3];
    }
  | { kind: "email_retry"; userId: UserId };

type CaptureIngestionDeps = {
  processNotification: NotificationHandler;
  processApplePayIntent: ApplePayHandler;
  processWidgetTransactions: WidgetHandler;
  processEmails: EmailBatchHandler;
  processRetries: EmailRetryHandler;
};

export type CaptureIngestionOutcome =
  | NotificationPipelineResult
  | ApplePayPipelineResult
  | WidgetPipelineResult;

export type EmailCaptureIngestionOutcome = PipelineResult | Awaited<ReturnType<ProcessRetries>>;

type AnyCaptureIngestionCommand = CaptureIngestionCommand | EmailCaptureIngestionCommand;

type AnyCaptureIngestionOutcome = CaptureIngestionOutcome | EmailCaptureIngestionOutcome;

export interface CaptureIngestionPort {
  ingest(command: CaptureIngestionCommand): Promise<CaptureIngestionOutcome>;
}

export interface CaptureIngestionPortWithEmail {
  ingest(command: CaptureIngestionCommand): Promise<CaptureIngestionOutcome>;
  ingest(command: EmailCaptureIngestionCommand): Promise<EmailCaptureIngestionOutcome>;
}

type SameFeatureDeps = Pick<
  CaptureIngestionDeps,
  "processNotification" | "processApplePayIntent" | "processWidgetTransactions"
>;

type EmailDeps = Pick<CaptureIngestionDeps, "processEmails" | "processRetries">;

let defaultDepsPromise: Promise<SameFeatureDeps> | null = null;

async function loadDefaultDeps(): Promise<SameFeatureDeps> {
  if (defaultDepsPromise) return defaultDepsPromise;

  defaultDepsPromise = (async () => {
    const [notification, applePay, widget] = await Promise.all([
      import("./notification-pipeline"),
      import("./apple-pay-pipeline"),
      import("./widget-pipeline"),
    ]);

    return {
      processNotification: notification.processNotification,
      processApplePayIntent: applePay.processApplePayIntent,
      processWidgetTransactions: widget.processWidgetTransactions,
    };
  })();

  return defaultDepsPromise;
}

export function createCaptureIngestionPort(
  db: AnyDb,
  deps?: Partial<SameFeatureDeps>
): CaptureIngestionPort;
export function createCaptureIngestionPort(
  db: AnyDb,
  deps: Partial<SameFeatureDeps> & EmailDeps
): CaptureIngestionPortWithEmail;
export function createCaptureIngestionPort(
  db: AnyDb,
  deps: Partial<CaptureIngestionDeps> = {}
): CaptureIngestionPort | CaptureIngestionPortWithEmail {
  const ingestDefault: CaptureIngestionPort["ingest"] = async (command) => {
    switch (command.kind) {
      case "notification": {
        const processNotification =
          deps.processNotification ?? (await loadDefaultDeps()).processNotification;
        return processNotification(db, command.userId, command.notification);
      }
      case "apple_pay": {
        const processApplePayIntent =
          deps.processApplePayIntent ?? (await loadDefaultDeps()).processApplePayIntent;
        return processApplePayIntent(db, command.userId, command.intent);
      }
      case "widget": {
        const processWidgetTransactions =
          deps.processWidgetTransactions ?? (await loadDefaultDeps()).processWidgetTransactions;
        return processWidgetTransactions(db, command.userId);
      }
    }
  };

  if (!deps.processEmails || !deps.processRetries) {
    return { ingest: ingestDefault };
  }

  const processEmails = deps.processEmails;
  const processRetries = deps.processRetries;

  function ingestWithEmail(command: CaptureIngestionCommand): Promise<CaptureIngestionOutcome>;
  function ingestWithEmail(
    command: EmailCaptureIngestionCommand
  ): Promise<EmailCaptureIngestionOutcome>;
  async function ingestWithEmail(
    command: AnyCaptureIngestionCommand
  ): Promise<AnyCaptureIngestionOutcome> {
    switch (command.kind) {
      case "notification":
      case "apple_pay":
      case "widget":
        return ingestDefault(command);
      case "email_batch":
        return processEmails(db, command.userId, command.emails, command.onProgress);
      case "email_retry":
        return processRetries(db, command.userId);
    }
  }

  return { ingest: ingestWithEmail };
}
