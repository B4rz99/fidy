import { getTemplateShapePrivacyFailure } from "./capture-improvement-template-shape-policy.ts";
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
  if (getTemplateShapePrivacyFailure(templateShape) !== null) {
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
