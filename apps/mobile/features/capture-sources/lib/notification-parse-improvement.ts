import { stripPii } from "@/features/email-capture/parsing.public";
import { capturePipelineEvent } from "@/shared/lib";
import {
  isAllowedStructuralLowercaseWord,
  isAllowedStructuralTitleWord,
} from "./capture-improvement-template-shape-policy";
import { insertNotificationParseImprovementSample } from "./notification-parse-improvement-repository";
export {
  deleteNotificationParseImprovementSamplesForUser,
  setNotificationParseImprovementPreference,
} from "./notification-parse-improvement-repository";

export type ParseImprovementStatus = "failed" | "needs_review";
export type ParseMethod = "regex" | "llm";
export type ConfidenceBucket = "none" | "low" | "medium" | "high";
export type CaptureImprovementProviderCategory = "bank" | "payment_app" | "wallet" | "unknown";

export type ParseImprovementInput = {
  readonly rawText: string;
  readonly parserTemplate?: string;
  readonly providerCategory?: CaptureImprovementProviderCategory;
  readonly senderDomain?: string | null;
  readonly source: string;
  readonly status: ParseImprovementStatus;
  readonly confidence: number | null;
  readonly parseMethod: ParseMethod;
};

export type ShareParseImprovementInput = ParseImprovementInput & {
  readonly consent: boolean;
  readonly userId: string;
};

const MAX_PARSE_IMPROVEMENT_TEMPLATE_LENGTH = 1000;
const PROVIDER_CATEGORY_BY_SOURCE: Readonly<
  Partial<Record<string, CaptureImprovementProviderCategory>>
> = {
  google_pay: "wallet",
};
const EMAIL_CAPTURE_IMPROVEMENT_SOURCES = new Set(["email_gmail", "email_outlook"]);
const BANK_PROVIDER_DOMAIN_PATTERN = /(?:banco|bank|bbva|davibank|davivienda|nequi|bancolombia)/iu;

type RedactionRule = {
  readonly pattern: RegExp;
  readonly replacement: string;
};

const SENSITIVE_VALUE_RULES: readonly RedactionRule[] = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  { pattern: /\+\d[\d\s-]{8,14}\d/g, replacement: "[PHONE]" },
  { pattern: /(?<!\d)3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, replacement: "[PHONE]" },
  {
    pattern:
      /\b(ref(?:erencia)?|autori[sz]aci[oó]n|authorization)\b\s*:?\s*(?:no\.?\s*)?#?\s*(?=[A-Z0-9-]{3,}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]{3,}\b/gi,
    replacement: "$1 [REFERENCE]",
  },
  {
    pattern:
      /\b(no\.?)\s+#?\s*(?=[A-Z0-9-]{3,}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]{3,}\b/gi,
    replacement: "$1 [REFERENCE]",
  },
  { pattern: /\b\d{10}\b/g, replacement: "[ID]" },
  { pattern: /\b\d{9,10}-\d\b/g, replacement: "[ID]" },
  { pattern: /\b\d{3}\.\d{3}\.\d{3,4}-?\d?\b/g, replacement: "[ID]" },
  {
    pattern: /\btarjeta\s+(?:terminada|finalizada)\s+en\s+\d{4}\b/gi,
    replacement: "tarjeta [CARD]",
  },
  {
    pattern: /\btarjeta\s+\d{4}\b/gi,
    replacement: "tarjeta [CARD]",
  },
  { pattern: /\b\d{11,14}\b/g, replacement: "[ACCOUNT]" },
  { pattern: /\b\d{4}\s+\d{4}\s+\d{3,6}\b/g, replacement: "[ACCOUNT]" },
  { pattern: /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, replacement: "[CARD]" },
  { pattern: /\b\d{15,16}\b/g, replacement: "[CARD]" },
  { pattern: /\d{4}[\s-]*[*Xx]{2,}[\s-]*[*Xx]{2,}[\s-]*\d{4}/g, replacement: "[CARD]" },
  { pattern: /(?:\*{1,4}|[Xx]{2,4})[\s.-]*\d{4}\b/g, replacement: "[CARD]" },
  {
    pattern: /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    replacement: "[DATE]",
  },
  { pattern: /\$\s*\d(?:[\d.,]*\d)?/g, replacement: "[AMOUNT]" },
  { pattern: /\bCOP\s*\d(?:[\d.,]*\d)?/gi, replacement: "[AMOUNT]" },
  { pattern: /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{4,9}\b/g, replacement: "[AMOUNT]" },
  { pattern: /\b\d+\b/g, replacement: "[NUMBER]" },
];

const COUNTERPARTY_RULES: readonly RedactionRule[] = [
  {
    pattern:
      /(^|[.;:]\s*)([a-záéíóúñ]{3,}(?:\s+[a-záéíóúñ]{2,}){0,3})(\s+(?:compra|purchase|pago|payment)\b)/g,
    replacement: "$1[COUNTERPARTY]$3",
  },
  {
    pattern: /(\ben\s+)(.+?)(?=\s+(?:el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern: /(\bat\s+)(.+?)(?=\s+(?:on|with|card|account)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern: /(\b(?:de|a)\s+)(.+?)(?=\s+(?:el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[COUNTERPARTY]",
  },
  {
    pattern:
      /(\b(?:comercio|establecimiento|beneficiario|destinatario|para)\b\s*:?\s*)(.+?)(?=\s+(?:por|of|for|el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[COUNTERPARTY]",
  },
  {
    pattern:
      /(\b(?:compra|purchase|pago|payment)\s+)(?!por\b|of\b|for\b)(.+?)(?=\s+(?:por|of|for|el|con|with|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern:
      /\b[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+(?=\s*:?\s+te\s+(?:envio|envió|transfirio|transfirió)\b)/gi,
    replacement: "[COUNTERPARTY]",
  },
];

const applyRedactionRule = (text: string, rule: RedactionRule): string =>
  text.replace(rule.pattern, rule.replacement);

const normalizeTemplateWhitespace = (text: string): string => text.trim().replace(/\s+/g, " ");

const RESIDUAL_ENTITY_TOKEN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\b(?!\])/g;
const RESIDUAL_LOWERCASE_ENTITY_TOKEN = /(?<!\[)\b[a-záéíóúñ]{3,}\b(?!\])/g;

const redactResidualEntityTokens = (text: string): string =>
  text.replace(RESIDUAL_ENTITY_TOKEN, (word) =>
    isAllowedStructuralTitleWord(word) ? word : "[ENTITY]"
  );

const redactResidualLowercaseEntityTokens = (text: string): string =>
  text.replace(RESIDUAL_LOWERCASE_ENTITY_TOKEN, (word) =>
    isAllowedStructuralLowercaseWord(word) ? word : "[ENTITY]"
  );

function confidenceBucket(confidence: number | null): ConfidenceBucket {
  if (confidence == null) return "none";
  if (confidence < 0.7) return "low";
  if (confidence < 0.9) return "medium";
  return "high";
}

export function anonymizeNotificationParseSample(rawText: string): string {
  return normalizeTemplateWhitespace(
    redactResidualEntityTokens(
      redactResidualLowercaseEntityTokens(
        COUNTERPARTY_RULES.reduce(
          applyRedactionRule,
          SENSITIVE_VALUE_RULES.reduce(applyRedactionRule, stripPii(rawText))
        )
      )
    )
  );
}

export function buildNotificationParseImprovementSample(input: ParseImprovementInput) {
  const template = clampParseImprovementTemplate(
    anonymizeNotificationParseSample(input.parserTemplate ?? input.rawText)
  );
  const providerCategory = captureImprovementProviderCategory(input);

  return {
    template,
    ...(providerCategory ? { providerCategory } : {}),
    source: input.source,
    status: input.status,
    confidenceBucket: confidenceBucket(input.confidence),
    parseMethod: input.parseMethod,
  };
}

const captureImprovementProviderCategory = (
  input: ParseImprovementInput
): CaptureImprovementProviderCategory | null =>
  input.providerCategory ??
  PROVIDER_CATEGORY_BY_SOURCE[input.source] ??
  emailProviderCategory(input);

const emailProviderCategory = (
  input: ParseImprovementInput
): CaptureImprovementProviderCategory | null =>
  EMAIL_CAPTURE_IMPROVEMENT_SOURCES.has(input.source)
    ? providerCategoryFromSenderDomain(input.senderDomain)
    : null;

const providerCategoryFromSenderDomain = (
  senderDomain: string | null | undefined
): CaptureImprovementProviderCategory =>
  senderDomain != null && BANK_PROVIDER_DOMAIN_PATTERN.test(senderDomain) ? "bank" : "unknown";

const LENGTH_BUCKETS = [
  { max: 20, label: "0_19" },
  { max: 50, label: "20_49" },
  { max: 100, label: "50_99" },
  { max: 250, label: "100_249" },
  { max: 500, label: "250_499" },
] as const;

const lengthBucket = (value: string): string =>
  LENGTH_BUCKETS.find((bucket) => value.length < bucket.max)?.label ?? "500_plus";

const clampParseImprovementTemplate = (template: string): string =>
  template.length <= MAX_PARSE_IMPROVEMENT_TEMPLATE_LENGTH
    ? template
    : template.slice(0, MAX_PARSE_IMPROVEMENT_TEMPLATE_LENGTH).trim();

export async function shareNotificationParseImprovementSample(
  input: ShareParseImprovementInput
): Promise<void> {
  if (!input.consent) return;

  const sample = buildNotificationParseImprovementSample(input);
  await insertNotificationParseImprovementSample({ userId: input.userId, sample });
  capturePipelineEvent({
    source: "notification_parse_improvement",
    schema: "notification_parse_improvement_v1",
    notificationSource: sample.source,
    status: sample.status,
    confidenceBucket: sample.confidenceBucket,
    parseMethod: sample.parseMethod,
    templateLengthBucket: lengthBucket(sample.template),
  });
}
