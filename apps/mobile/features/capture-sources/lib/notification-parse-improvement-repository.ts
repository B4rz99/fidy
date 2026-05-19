import { CryptoDigestAlgorithm, digest } from "expo-crypto";
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

async function sha256Hex(value: string): Promise<string> {
  const hash = await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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

  const { error } = await getSupabase()
    .from("notification_parse_improvement_samples")
    .insert({
      user_id: input.userId,
      source: input.sample.source,
      sender_domain: input.sample.senderDomain ?? null,
      status: input.sample.status,
      confidence_bucket: input.sample.confidenceBucket,
      parse_method: input.sample.parseMethod,
      template: input.sample.template,
      template_hash: await sha256Hex(input.sample.template),
      review_status: "pending",
    });

  if (error != null) {
    throw new ParseImprovementSampleInsertError({
      code: error.code,
      details: error.details,
    });
  }
}
