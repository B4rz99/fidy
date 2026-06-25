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

export class ParseImprovementSampleAccountSessionError extends Error {
  constructor() {
    super("Capture improvement account session changed");
    this.name = "ParseImprovementSampleAccountSessionError";
  }
}

type InsertNotificationParseImprovementSampleInput = {
  readonly userId: string;
  readonly sample: PersistedNotificationParseImprovementSample;
};

type CaptureImprovementSourceChannel = "email" | "notification" | "wallet";
type CaptureImprovementSourceFamily = "email" | "android_notification" | "wallet_notification";
type CaptureImprovementProviderCategory = "bank" | "payment_app" | "wallet" | "unknown";
type CaptureImprovementSourceProvider = "gmail" | "outlook";

type CaptureImprovementSamplePayload = {
  readonly sourceChannel: CaptureImprovementSourceChannel;
  readonly sourceFamily: CaptureImprovementSourceFamily;
  readonly sourceProvider?: CaptureImprovementSourceProvider;
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
type CaptureImprovementBoundaryAuth = {
  readonly headers: {
    readonly Authorization: string;
  };
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
const SOURCE_PROVIDER_BY_SOURCE: Readonly<
  Partial<Record<string, CaptureImprovementSourceProvider>>
> = {
  email_gmail: "gmail",
  email_outlook: "outlook",
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

  const supabase = getSupabase();
  const auth = await captureImprovementBoundaryAuth(supabase, input.userId);
  const { data, error } = await supabase.functions.invoke<CaptureImprovementApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "retainCaptureImprovementSample",
        sample: toCaptureImprovementSamplePayload(input.sample),
      },
      ...auth,
    }
  );

  await assertCaptureImprovementBoundarySuccess(data, error);
}

export async function deleteNotificationParseImprovementSamplesForUser(_input: {
  readonly userId: string;
}): Promise<void> {
  const supabase = getSupabase();
  const auth = await captureImprovementBoundaryAuth(supabase, _input.userId);
  const { data, error } = await supabase.functions.invoke<CaptureImprovementApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "deleteCaptureImprovementSamples",
      },
      ...auth,
    }
  );

  await assertCaptureImprovementBoundarySuccess(data, error);
}

export async function setNotificationParseImprovementPreference(_input: {
  readonly userId: string;
  readonly enabled: boolean;
}): Promise<void> {
  const supabase = getSupabase();
  const auth = await captureImprovementBoundaryAuth(supabase, _input.userId);
  const { data, error } = await supabase.functions.invoke<CaptureImprovementApiResponse>(
    CLOUD_LEDGER_FUNCTION,
    {
      body: {
        action: "setCaptureImprovementPreference",
        enabled: _input.enabled,
      },
      ...auth,
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

const captureImprovementBoundaryAuth = async (
  supabase: ReturnType<typeof getSupabase>,
  userId: string
): Promise<CaptureImprovementBoundaryAuth> => {
  const { data, error } = await supabase.auth.getSession();
  const session = error === null ? data.session : null;
  if (session?.user.id !== userId) {
    throw new ParseImprovementSampleAccountSessionError();
  }

  return {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  };
};

const throwIfKnownFailureResponse = (data: CaptureImprovementApiResponse | null): void => {
  if (data?.success !== false) return;
  throwCaptureImprovementBoundaryFailure(data.error);
};

const throwIfRemoteBoundaryError = async (error: RemoteErrorLike | null): Promise<void> => {
  if (error != null) {
    const remoteFailure = await readRemoteError(error);
    throwCaptureImprovementBoundaryFailure(remoteFailure);
    throw new ParseImprovementSampleInsertError({
      details: error.message,
    });
  }
};

const throwCaptureImprovementBoundaryFailure = (
  failure: CaptureImprovementApiFailureCode | null
): void => {
  const error = captureImprovementBoundaryFailureError(failure);
  if (error !== null) throw error;
};

const captureImprovementBoundaryFailureError = (
  failure: CaptureImprovementApiFailureCode | null
): Error | null => {
  switch (failure) {
    case "unsafe_capture_improvement_sample":
      return new ParseImprovementSamplePrivacyError("remote_unsafe_sample");
    case "capture_improvement_opted_out":
      return new ParseImprovementSampleOptOutError();
    case "invalid_capture_improvement_sample":
      return new ParseImprovementSampleInsertError({
        code: "invalid_capture_improvement_sample",
      });
    default:
      return null;
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
  const provider = sourceProvider(sample.source);
  return {
    sourceChannel: sourceChannel(sample.source),
    sourceFamily: sourceFamily(sample.source),
    ...(provider === undefined ? {} : { sourceProvider: provider }),
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

const sourceProvider = (source: string): CaptureImprovementSourceProvider | undefined =>
  SOURCE_PROVIDER_BY_SOURCE[source];

const providerCategory = (
  sample: PersistedNotificationParseImprovementSample
): CaptureImprovementProviderCategory => {
  if (sample.providerCategory !== undefined) return sample.providerCategory;
  const category = PROVIDER_CATEGORY_BY_SOURCE[sample.source];
  return category === undefined ? "unknown" : category;
};
