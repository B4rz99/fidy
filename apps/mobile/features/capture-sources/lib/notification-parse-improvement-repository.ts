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
const BANK_PROVIDER_DOMAIN_PATTERN = /(?:banco|bank|bbva|davibank|davivienda|nequi|bancolombia)/iu;

const SENSITIVE_TEMPLATE_PATTERNS = [
  String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
  String.raw`\+\d[\d\s-]{8,14}\d`,
  String.raw`(?<!\d)3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b`,
  String.raw`\b(?:ref(?:erencia)?|autori[sz]aci[oó]n|authorization)\b\s*:?\s*#?\s*(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b`,
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
const LOWERCASE_CONTEXT_ENTITY_PATTERN =
  /\b(?:a|at|beneficiario|cerca de|comercio|de|destinatario|en|establecimiento|para)\b\s*:?\s+(?!\[)[a-záéíóúñ]{3,}(?:\s+(?!\[)[a-záéíóúñ]{2,})*/i;
const UNREDACTED_LOCATION_PATTERN =
  /\b(?:bogot[aá]|medell[ií]n|cali|barranquilla|cartagena|colombia)\b/i;
const RESIDUAL_ENTITY_PATTERN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*\b(?!\])/;
const STRUCTURAL_TITLE_WORDS = new Set([
  "Abono",
  "Autorizacion",
  "Autorización",
  "Authorization",
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

const TEMPLATE_PRIVACY_CHECKS: readonly {
  readonly reason: string;
  readonly isUnsafe: (template: string) => boolean;
}[] = [
  {
    reason: "sensitive_value_pattern",
    isUnsafe: (template) => SENSITIVE_TEMPLATE_PATTERNS.some((pattern) => pattern.test(template)),
  },
  {
    reason: "lowercase_counterparty_pattern",
    isUnsafe: (template) => LOWERCASE_COUNTERPARTY_PATTERN.test(template),
  },
  {
    reason: "lowercase_context_entity_pattern",
    isUnsafe: (template) => LOWERCASE_CONTEXT_ENTITY_PATTERN.test(template),
  },
  {
    reason: "unredacted_location",
    isUnsafe: (template) => UNREDACTED_LOCATION_PATTERN.test(template),
  },
  {
    reason: "residual_entity_pattern",
    isUnsafe: (template) => RESIDUAL_ENTITY_PATTERN.test(template),
  },
  {
    reason: "residual_title_entity",
    isUnsafe: hasResidualTitleEntity,
  },
];

function assertTemplateIsAnonymized(template: string): void {
  const failure = TEMPLATE_PRIVACY_CHECKS.find((check) => check.isUnsafe(template));
  if (failure) {
    throw new ParseImprovementSamplePrivacyError(failure.reason);
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
  const category = PROVIDER_CATEGORY_BY_SOURCE[sample.source];
  return category === undefined ? providerCategoryFromSenderDomain(sample.senderDomain) : category;
};

const providerCategoryFromSenderDomain = (
  senderDomain: string | null | undefined
): CaptureImprovementProviderCategory =>
  senderDomain == null ? "unknown" : providerCategoryFromDomain(senderDomain);

const providerCategoryFromDomain = (senderDomain: string): CaptureImprovementProviderCategory =>
  BANK_PROVIDER_DOMAIN_PATTERN.test(senderDomain) ? "bank" : "payment_app";
