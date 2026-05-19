import { stripPii } from "@/features/email-capture/parsing.public";
import { capturePipelineEvent } from "@/shared/lib";
import { insertNotificationParseImprovementSample } from "./notification-parse-improvement-repository";

export type ParseImprovementStatus = "failed" | "needs_review";
export type ParseMethod = "regex" | "llm";
export type ConfidenceBucket = "none" | "low" | "medium" | "high";

export type ParseImprovementInput = {
  readonly rawText: string;
  readonly parserTemplate?: string;
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

type RedactionRule = {
  readonly pattern: RegExp;
  readonly replacement: string;
};

const SENSITIVE_VALUE_RULES: readonly RedactionRule[] = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  { pattern: /\+\d[\d\s-]{8,14}\d/g, replacement: "[PHONE]" },
  { pattern: /(?<!\d)3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, replacement: "[PHONE]" },
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
      /(\b(?:comercio|establecimiento|beneficiario|destinatario|para)\s+)(.+?)(?=\s+(?:el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
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

const RESIDUAL_ENTITY_TOKEN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\b(?!\])/g;

const redactResidualEntityTokens = (text: string): string =>
  text.replace(RESIDUAL_ENTITY_TOKEN, (word) =>
    STRUCTURAL_TITLE_WORDS.has(word) ? word : "[ENTITY]"
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
      COUNTERPARTY_RULES.reduce(
        applyRedactionRule,
        SENSITIVE_VALUE_RULES.reduce(applyRedactionRule, stripPii(rawText))
      )
    )
  );
}

export function buildNotificationParseImprovementSample(input: ParseImprovementInput) {
  return {
    template: input.parserTemplate ?? anonymizeNotificationParseSample(input.rawText),
    ...(input.senderDomain ? { senderDomain: input.senderDomain } : {}),
    source: input.source,
    status: input.status,
    confidenceBucket: confidenceBucket(input.confidence),
    parseMethod: input.parseMethod,
  };
}

const LENGTH_BUCKETS = [
  { max: 20, label: "0_19" },
  { max: 50, label: "20_49" },
  { max: 100, label: "50_99" },
  { max: 250, label: "100_249" },
  { max: 500, label: "250_499" },
] as const;

const lengthBucket = (value: string): string =>
  LENGTH_BUCKETS.find((bucket) => value.length < bucket.max)?.label ?? "500_plus";

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
