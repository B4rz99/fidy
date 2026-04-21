import type {
  PipelineResult,
  ProcessEmails,
  ProcessRetries,
} from "@/features/email-capture/pipeline.public";
import type { AnyDb } from "@/shared/db";
import { fromThunk, runAppEffect } from "@/shared/effect/runtime";
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
type IngestSameFeatureCommandInput = {
  readonly db: AnyDb;
  readonly deps: Partial<SameFeatureDeps>;
  readonly command: CaptureIngestionCommand;
};
type IngestEmailCommandInput = {
  readonly db: AnyDb;
  readonly deps: EmailDeps;
  readonly command: EmailCaptureIngestionCommand;
};

let defaultDepsPromise: Promise<SameFeatureDeps> | null = null;

async function importDefaultDeps(): Promise<SameFeatureDeps> {
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
}

async function loadDefaultDeps(): Promise<SameFeatureDeps> {
  if (defaultDepsPromise) return defaultDepsPromise;

  defaultDepsPromise = importDefaultDeps();

  return defaultDepsPromise;
}

async function getNotificationHandler(
  deps: Partial<SameFeatureDeps>
): Promise<NotificationHandler> {
  return deps.processNotification ?? (await loadDefaultDeps()).processNotification;
}

async function getApplePayHandler(deps: Partial<SameFeatureDeps>): Promise<ApplePayHandler> {
  return deps.processApplePayIntent ?? (await loadDefaultDeps()).processApplePayIntent;
}

async function getWidgetHandler(deps: Partial<SameFeatureDeps>): Promise<WidgetHandler> {
  return deps.processWidgetTransactions ?? (await loadDefaultDeps()).processWidgetTransactions;
}

async function ingestSameFeatureCommand(
  input: IngestSameFeatureCommandInput
): Promise<CaptureIngestionOutcome> {
  switch (input.command.kind) {
    case "notification":
      return (await getNotificationHandler(input.deps))(
        input.db,
        input.command.userId,
        input.command.notification
      );
    case "apple_pay":
      return (await getApplePayHandler(input.deps))(
        input.db,
        input.command.userId,
        input.command.intent
      );
    case "widget":
      return (await getWidgetHandler(input.deps))(input.db, input.command.userId);
  }
}

function isSameFeatureCommand(
  command: AnyCaptureIngestionCommand
): command is CaptureIngestionCommand {
  return (
    command.kind === "notification" || command.kind === "apple_pay" || command.kind === "widget"
  );
}

async function ingestEmailCommand(
  input: IngestEmailCommandInput
): Promise<EmailCaptureIngestionOutcome> {
  switch (input.command.kind) {
    case "email_batch":
      return input.deps.processEmails(
        input.db,
        input.command.userId,
        input.command.emails,
        input.command.onProgress
      );
    case "email_retry":
      return input.deps.processRetries(input.db, input.command.userId);
  }
}

function hasEmailDeps(
  deps: Partial<CaptureIngestionDeps>
): deps is Partial<SameFeatureDeps> & EmailDeps {
  return Boolean(deps.processEmails && deps.processRetries);
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
  const ingestDefault: CaptureIngestionPort["ingest"] = (command) =>
    runAppEffect(fromThunk(() => ingestSameFeatureCommand({ db, deps, command })));

  if (!hasEmailDeps(deps)) {
    return { ingest: ingestDefault };
  }

  const emailDeps = deps;

  function ingestWithEmail(command: CaptureIngestionCommand): Promise<CaptureIngestionOutcome>;
  function ingestWithEmail(
    command: EmailCaptureIngestionCommand
  ): Promise<EmailCaptureIngestionOutcome>;
  function ingestWithEmail(
    command: AnyCaptureIngestionCommand
  ): Promise<AnyCaptureIngestionOutcome> {
    return isSameFeatureCommand(command)
      ? ingestDefault(command)
      : runAppEffect(fromThunk(() => ingestEmailCommand({ db, deps: emailDeps, command })));
  }

  return { ingest: ingestWithEmail };
}
