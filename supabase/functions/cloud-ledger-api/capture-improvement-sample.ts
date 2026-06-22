import type { CaptureImprovementSample } from "./model.ts";

export type CaptureImprovementSampleReadResult =
  | { readonly kind: "valid"; readonly sample: CaptureImprovementSample }
  | { readonly kind: "invalid" }
  | { readonly kind: "unsafe" };

const SOURCE_CHANNELS: ReadonlySet<CaptureImprovementSample["sourceChannel"]> = new Set([
  "email",
  "notification",
  "wallet",
]);
const SOURCE_FAMILIES: ReadonlySet<CaptureImprovementSample["sourceFamily"]> = new Set([
  "email",
  "android_notification",
  "wallet_notification",
]);
const PROVIDER_CATEGORIES: ReadonlySet<CaptureImprovementSample["providerCategory"]> = new Set([
  "bank",
  "payment_app",
  "wallet",
  "unknown",
]);
const PARSE_OUTCOMES: ReadonlySet<CaptureImprovementSample["parseOutcome"]> = new Set([
  "failed",
  "needs_review",
]);
const CONFIDENCE_BUCKETS: ReadonlySet<CaptureImprovementSample["confidenceBucket"]> = new Set([
  "none",
  "low",
  "medium",
  "high",
]);
const EXTRACTOR_METHODS: ReadonlySet<CaptureImprovementSample["extractor"]["method"]> = new Set([
  "regex",
  "llm",
]);
const SAMPLE_KEYS = new Set([
  "confidenceBucket",
  "extractor",
  "parseOutcome",
  "providerCategory",
  "sourceChannel",
  "sourceFamily",
  "templateShape",
]);
const EXTRACTOR_KEYS = new Set(["method", "version"]);
const MAX_TEMPLATE_SHAPE_LENGTH = 1000;

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

export function readCaptureImprovementSample(body: unknown): CaptureImprovementSampleReadResult {
  if (body === null || typeof body !== "object") {
    return { kind: "invalid" };
  }
  const sample = (body as Record<string, unknown>).sample;
  if (sample === null || typeof sample !== "object") {
    return { kind: "invalid" };
  }
  const record = sample as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(record, SAMPLE_KEYS)) {
    return { kind: "invalid" };
  }

  const extractor = readExtractor(record.extractor);
  if (
    !isSetValue(record.sourceChannel, SOURCE_CHANNELS) ||
    !isSetValue(record.sourceFamily, SOURCE_FAMILIES) ||
    !isSetValue(record.providerCategory, PROVIDER_CATEGORIES) ||
    !isSafeTemplateShape(record.templateShape) ||
    !isSetValue(record.parseOutcome, PARSE_OUTCOMES) ||
    !isSetValue(record.confidenceBucket, CONFIDENCE_BUCKETS) ||
    extractor === null
  ) {
    return { kind: "invalid" };
  }

  const templateShape = record.templateShape.trim().replace(/\s+/g, " ");
  if (hasUnsafeTemplateContent(templateShape)) {
    return { kind: "unsafe" };
  }

  return {
    kind: "valid",
    sample: {
      sourceChannel: record.sourceChannel,
      sourceFamily: record.sourceFamily,
      providerCategory: record.providerCategory,
      templateShape,
      parseOutcome: record.parseOutcome,
      confidenceBucket: record.confidenceBucket,
      extractor,
    },
  };
}

function readExtractor(value: unknown): CaptureImprovementSample["extractor"] | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return hasOnlyAllowedKeys(record, EXTRACTOR_KEYS) &&
    isSetValue(record.method, EXTRACTOR_METHODS) &&
    record.version === 1
    ? { method: record.method, version: 1 }
    : null;
}

function hasOnlyAllowedKeys(record: Record<string, unknown>, allowedKeys: ReadonlySet<string>) {
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function isSetValue<T extends string>(value: unknown, values: ReadonlySet<T>): value is T {
  return typeof value === "string" && values.has(value as T);
}

function isSafeTemplateShape(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_TEMPLATE_SHAPE_LENGTH
  );
}

function hasUnsafeTemplateContent(templateShape: string): boolean {
  return (
    SENSITIVE_TEMPLATE_PATTERNS.some((pattern) => pattern.test(templateShape)) ||
    LOWERCASE_COUNTERPARTY_PATTERN.test(templateShape) ||
    LOWERCASE_CONTEXT_ENTITY_PATTERN.test(templateShape) ||
    UNREDACTED_LOCATION_PATTERN.test(templateShape) ||
    RESIDUAL_ENTITY_PATTERN.test(templateShape) ||
    hasResidualTitleEntity(templateShape)
  );
}

function hasResidualTitleEntity(templateShape: string): boolean {
  return Array.from(templateShape.matchAll(RESIDUAL_TITLE_TOKEN)).some(
    ([word]) => typeof word === "string" && !STRUCTURAL_TITLE_WORDS.has(word)
  );
}
