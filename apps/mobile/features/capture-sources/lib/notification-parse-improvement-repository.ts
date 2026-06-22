import { getSupabase } from "@/shared/db";

export type PersistedNotificationParseImprovementSample = {
  readonly template: string;
  readonly senderDomain?: string | null;
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
        | "internal_error"
        | "invalid_capture_improvement_sample"
        | "unsafe_capture_improvement_sample";
    };

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
const BANK_PROVIDER_DOMAIN_PATTERN = /(?:banco|bank|bbva|davibank|davivienda|nequi|bancolombia)/iu;

const SENSITIVE_TEMPLATE_PATTERNS = [
  String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
  String.raw`\+\d[\d\s-]{8,14}\d`,
  String.raw`(?<!\d)3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b`,
  String.raw`\b(?:C\.?\s?C\.?|T\.?\s?I\.?|C\.?\s?E\.?|[Cc][eé]dula)\s*:?\s*#?\s*\d{6,11}\b`,
  String.raw`\bNIT\s*:?\s*\d{3}\.?\d{3}\.?\d{3,4}-?\d?\b`,
  String.raw`\b\d{9,10}-\d\b`,
  String.raw`\b\d{3}\.\d{3}\.\d{3,4}-?\d?\b`,
  String.raw`(?:(?:No\.?\s*)?Cuenta|Cta\.?)\s*(?:(?:de\s+)?(?:Ahorros|Corriente)\s*)?(?:No\.?\s*)?#?\s{0,3}\d{8,20}`,
  String.raw`\b\d{11,14}\b`,
  String.raw`\b\d{4}\s+\d{4}\s+\d{3,6}\b`,
  String.raw`(?<!\d)\(?60[1-8]\)?[\s-]?\d{3}[\s-]?\d{4}\b`,
  String.raw`\btarjeta\s+(?:terminada|finalizada)\s+en\s+\d{4}\b`,
  String.raw`\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b`,
  String.raw`\b\d{15,16}\b`,
  String.raw`\d{4}[\s-]*[*Xx]{2,}[\s-]*[*Xx]{2,}[\s-]*\d{4}`,
  String.raw`[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*\d{4}`,
  String.raw`(?<![A-Za-z0-9])(?:\*{1,4}|[Xx]{2,4})[\s.-]*\d{4}\b`,
  String.raw`\b\d+\b`,
].map((pattern) => new RegExp(pattern, "i"));
const LOWERCASE_COUNTERPARTY_PATTERN =
  /\b[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+\s*:?\s+te\s+(?:envio|envió|transfirio|transfirió)\b/i;
const RESIDUAL_ENTITY_PATTERN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*\b(?!\])/;
const STRUCTURAL_TITLE_WORDS = new Set([
  "Abono",
  "Beneficiario",
  "Cel",
  "Compra",
  "Comercio",
  "Consignacion",
  "Consignación",
  "Deposito",
  "Depósito",
  "Destinatario",
  "Establecimiento",
  "Pago",
  "Recibiste",
  "Ref",
  "Referencia",
  "Tarjeta",
  "Tel",
  "Transferencia",
]);
const RESIDUAL_TITLE_TOKEN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\b(?!\])/g;

const hasResidualTitleEntity = (template: string): boolean =>
  Array.from(template.matchAll(RESIDUAL_TITLE_TOKEN)).some(
    ([word]) => typeof word === "string" && !STRUCTURAL_TITLE_WORDS.has(word)
  );

function assertTemplateIsAnonymized(template: string): void {
  if (SENSITIVE_TEMPLATE_PATTERNS.some((pattern) => pattern.test(template))) {
    throw new ParseImprovementSamplePrivacyError("sensitive_value_pattern");
  }
  if (LOWERCASE_COUNTERPARTY_PATTERN.test(template)) {
    throw new ParseImprovementSamplePrivacyError("lowercase_counterparty_pattern");
  }
  if (RESIDUAL_ENTITY_PATTERN.test(template)) {
    throw new ParseImprovementSamplePrivacyError("residual_entity_pattern");
  }
  if (hasResidualTitleEntity(template)) {
    throw new ParseImprovementSamplePrivacyError("residual_title_entity");
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

const assertCaptureImprovementBoundarySuccess = async (
  data: CaptureImprovementApiResponse | null,
  error: RemoteErrorLike | null
): Promise<void> => {
  throwIfUnsafeSampleResponse(data);
  await throwIfRemoteBoundaryError(error);
  throwIfMissingSuccess(data);
};

const throwIfUnsafeSampleResponse = (data: CaptureImprovementApiResponse | null): void => {
  if (data?.success === false && data.error === "unsafe_capture_improvement_sample") {
    throw new ParseImprovementSamplePrivacyError("remote_unsafe_sample");
  }
};

const throwIfRemoteBoundaryError = async (error: RemoteErrorLike | null): Promise<void> => {
  if (error != null) {
    const remoteFailure = await readRemoteError(error);
    if (remoteFailure === "unsafe_capture_improvement_sample") {
      throw new ParseImprovementSamplePrivacyError("remote_unsafe_sample");
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
): Promise<"invalid_capture_improvement_sample" | "unsafe_capture_improvement_sample" | null> => {
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

const isCaptureImprovementApiFailure = (
  value: unknown
): value is Extract<CaptureImprovementApiResponse, { readonly success: false }> => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.success === false &&
    (record.error === "invalid_capture_improvement_sample" ||
      record.error === "unsafe_capture_improvement_sample")
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
  const category = PROVIDER_CATEGORY_BY_SOURCE[sample.source];
  return category === undefined ? providerCategoryFromSenderDomain(sample.senderDomain) : category;
};

const providerCategoryFromSenderDomain = (
  senderDomain: string | null | undefined
): CaptureImprovementProviderCategory =>
  senderDomain == null ? "unknown" : providerCategoryFromDomain(senderDomain);

const providerCategoryFromDomain = (senderDomain: string): CaptureImprovementProviderCategory =>
  BANK_PROVIDER_DOMAIN_PATTERN.test(senderDomain) ? "bank" : "payment_app";
