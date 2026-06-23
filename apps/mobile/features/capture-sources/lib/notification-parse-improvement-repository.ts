import { getSupabase } from "@/shared/db";
import {
  getTemplateShapePrivacyFailure,
  type TemplateShapePrivacyFailureReason,
} from "./capture-improvement-template-shape-policy";

export type PersistedNotificationParseImprovementSample = {
  readonly template: string;
  readonly providerCategory?: CaptureImprovementProviderCategory;
  readonly source: string;
  readonly status: "failed" | "needs_review";
  readonly confidenceBucket: "none" | "low" | "medium" | "high";
  readonly parseMethod: "regex" | "llm";
};

export class ParseImprovementSampleInsertError extends Error {
  readonly code: string | null;
  readonly details: string | null;

  constructor(input: { readonly code?: string; readonly details?: string }) {
    super("Unable to store parse improvement sample");
    this.name = "ParseImprovementSampleInsertError";
    this.code = input.code ?? null;
    this.details = input.details ?? null;
  }
}

export class ParseImprovementSamplePrivacyError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Parse improvement sample still contains sensitive values");
    this.name = "ParseImprovementSamplePrivacyError";
    this.reason = reason;
  }
}

export class ParseImprovementSampleOptOutError extends Error {
  constructor() {
    super("Capture Improvement Preference is disabled");
    this.name = "ParseImprovementSampleOptOutError";
  }
}

type InsertNotificationParseImprovementSampleInput = {
  readonly userId: string;
  readonly sample: PersistedNotificationParseImprovementSample;
};

type CaptureImprovementSourceChannel = "email" | "notification" | "wallet";
type CaptureImprovementSourceFamily = "email" | "android_notification" | "wallet_notification";
type CaptureImprovementProviderCategory = "bank" | "payment_app" | "wallet" | "unknown";

type CaptureImprovementSamplePayload = {
  readonly sourceChannel: CaptureImprovementSourceChannel;
  readonly sourceFamily: CaptureImprovementSourceFamily;
  readonly providerCategory: CaptureImprovementProviderCategory;
  readonly templateShape: string;
  readonly parseOutcome: "failed" | "needs_review";
  readonly confidenceBucket: "none" | "low" | "medium" | "high";
  readonly extractor: {
    readonly method: "regex" | "llm";
    readonly version: 1;
  };
};

type CaptureImprovementApiResponse =
  | { readonly success: true; readonly data: { readonly code: "accepted" } }
  | {
      readonly success: false;
      readonly error:
        | "capture_improvement_opted_out"
        | "internal_error"
        | "invalid_capture_improvement_sample"
        | "unsafe_capture_improvement_sample";
    };
type CaptureImprovementApiFailure = Extract<
  CaptureImprovementApiResponse,
  { readonly success: false }
>;
type CaptureImprovementApiFailureCode = CaptureImprovementApiFailure["error"];

type RemoteErrorLike = {
  readonly context?: unknown;
  readonly message?: string;
};

const CLOUD_LEDGER_FUNCTION = "cloud-ledger-api";
const SOURCE_CHANNEL_BY_SOURCE: Readonly<Record<string, CaptureImprovementSourceChannel>> = {
  email_gmail: "email",
  email_outlook: "email",
  google_pay: "wallet",
  notification_android: "notification",
};
const SOURCE_FAMILY_BY_SOURCE: Readonly<Record<string, CaptureImprovementSourceFamily>> = {
  email_gmail: "email",
  email_outlook: "email",
  google_pay: "wallet_notification",
  notification_android: "android_notification",
};
const PROVIDER_CATEGORY_BY_SOURCE: Readonly<
  Partial<Record<string, CaptureImprovementProviderCategory>>
> = {
  google_pay: "wallet",
  notification_android: "unknown",
};

function assertTemplateIsAnonymized(template: string): void {
  const failure: TemplateShapePrivacyFailureReason | null =
    getTemplateShapePrivacyFailure(template);
  if (failure) {
    throw new ParseImprovementSamplePrivacyError(failure);
  }
}

export async function insertNotificationParseImprovementSample(
  input: InsertNotificationParseImprovementSampleInput
): Promise<void> {
  assertTemplateIsAnonymized(input.sample.template);

  const { data, error } = await getSupabase().functions.invoke<CaptureImprovementApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "retainCaptureImprovementSample",
        sample: toCaptureImprovementSamplePayload(input.sample),
      },
    }
  );

  await assertCaptureImprovementBoundarySuccess(data, error);
}

export async function deleteNotificationParseImprovementSamplesForUser(_input: {
  readonly userId: string;
}): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke<CaptureImprovementApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "deleteCaptureImprovementSamples",
      },
    }
  );

  await assertCaptureImprovementBoundarySuccess(data, error);
}

export async function setNotificationParseImprovementPreference(_input: {
  readonly userId: string;
  readonly enabled: boolean;
}): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke<CaptureImprovementApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "setCaptureImprovementPreference",
        enabled: _input.enabled,
      },
    }
  );

  await assertCaptureImprovementBoundarySuccess(data, error);
}

const assertCaptureImprovementBoundarySuccess = async (
  data: CaptureImprovementApiResponse | null,
  error: RemoteErrorLike | null
): Promise<void> => {
  throwIfKnownFailureResponse(data);
  await throwIfRemoteBoundaryError(error);
  throwIfMissingSuccess(data);
};

const throwIfKnownFailureResponse = (data: CaptureImprovementApiResponse | null): void => {
  if (data?.success === false && data.error === "unsafe_capture_improvement_sample") {
    throw new ParseImprovementSamplePrivacyError("remote_unsafe_sample");
  }
  if (data?.success === false && data.error === "capture_improvement_opted_out") {
    throw new ParseImprovementSampleOptOutError();
  }
};

const throwIfRemoteBoundaryError = async (error: RemoteErrorLike | null): Promise<void> => {
  if (error != null) {
    const remoteFailure = await readRemoteError(error);
    if (remoteFailure === "unsafe_capture_improvement_sample") {
      throw new ParseImprovementSamplePrivacyError("remote_unsafe_sample");
    }
    if (remoteFailure === "capture_improvement_opted_out") {
      throw new ParseImprovementSampleOptOutError();
    }
    throw new ParseImprovementSampleInsertError({
      details: error.message,
    });
  }
};

const throwIfMissingSuccess = (data: CaptureImprovementApiResponse | null): void => {
  if (data?.success !== true) {
    throw new ParseImprovementSampleInsertError({});
  }
};

const readRemoteError = async (
  error: RemoteErrorLike
): Promise<
  | "capture_improvement_opted_out"
  | "invalid_capture_improvement_sample"
  | "unsafe_capture_improvement_sample"
  | null
> => {
  if (error.context === undefined) {
    return null;
  }
  try {
    const body = await readRemoteErrorContext(error.context);
    return isCaptureImprovementApiFailure(body) && body.error !== "internal_error"
      ? body.error
      : null;
  } catch {
    return null;
  }
};

const readRemoteErrorContext = async (context: unknown): Promise<unknown> =>
  hasJsonReader(context) ? await context.json() : context;

const hasJsonReader = (value: unknown): value is { readonly json: () => Promise<unknown> } =>
  value !== null &&
  typeof value === "object" &&
  "json" in value &&
  typeof (value as { readonly json?: unknown }).json === "function";

const CAPTURE_IMPROVEMENT_API_FAILURE_CODES = new Set<CaptureImprovementApiFailureCode>([
  "capture_improvement_opted_out",
  "invalid_capture_improvement_sample",
  "unsafe_capture_improvement_sample",
]);

const isCaptureImprovementApiFailure = (value: unknown): value is CaptureImprovementApiFailure => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.success === false &&
    typeof record.error === "string" &&
    CAPTURE_IMPROVEMENT_API_FAILURE_CODES.has(record.error as CaptureImprovementApiFailureCode)
  );
};

const toCaptureImprovementSamplePayload = (
  sample: PersistedNotificationParseImprovementSample
): CaptureImprovementSamplePayload => {
  const extractor = captureImprovementExtractor(sample.parseMethod);
  return {
    sourceChannel: sourceChannel(sample.source),
    sourceFamily: sourceFamily(sample.source),
    providerCategory: providerCategory(sample),
    templateShape: sample.template,
    parseOutcome: sample.status,
    confidenceBucket: sample.confidenceBucket,
    extractor,
  };
};

const captureImprovementExtractor = (parseMethod: "regex" | "llm") =>
  ({
    method: parseMethod,
    version: 1 as const,
  }) as const;

const sourceChannel = (source: string): CaptureImprovementSourceChannel => {
  const channel = SOURCE_CHANNEL_BY_SOURCE[source];
  return channel === undefined ? "notification" : channel;
};

const sourceFamily = (source: string): CaptureImprovementSourceFamily => {
  const family = SOURCE_FAMILY_BY_SOURCE[source];
  return family === undefined ? "android_notification" : family;
};

const providerCategory = (
  sample: PersistedNotificationParseImprovementSample
): CaptureImprovementProviderCategory => {
  if (sample.providerCategory !== undefined) return sample.providerCategory;
  const category = PROVIDER_CATEGORY_BY_SOURCE[sample.source];
  return category === undefined ? "unknown" : category;
};
