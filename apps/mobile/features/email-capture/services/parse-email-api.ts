import type { ParseEmailOptions } from "./create-parse-email-service";
import type { LlmParsedTransaction } from "./llm-parser";
import { liveParseEmailService, retryableParseEmailService } from "./parse-email-service";

type RedactionRule = {
  pattern: RegExp;
  replacement: string;
};

const REDACTION_RULES: readonly RedactionRule[] = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  { pattern: /\+\d[\d\s-]{8,14}\d/g, replacement: "[PHONE]" },
  // ID patterns must run before local phone — cedulas starting with 601-608 would otherwise match phones
  {
    pattern: /\b(?:C\.?\s?C\.?|T\.?\s?I\.?|C\.?\s?E\.?|[Cc][eé]dula)\s*:?\s*#?\s*\d{6,11}\b/gi,
    replacement: "[ID]",
  },
  { pattern: /\bNIT\s*:?\s*\d{3}\.?\d{3}\.?\d{3,4}-?\d?\b/gi, replacement: "[ID]" },
  {
    pattern:
      /(?:(?:No\.?\s*)?Cuenta|Cta\.?)\s*(?:(?:de\s+)?(?:Ahorros|Corriente)\s*)?(?:No\.?\s*)?#?\s{0,3}\d{8,20}/gi,
    replacement: "[ACCOUNT]",
  },
  { pattern: /(?<!\d)\(?60[1-8]\)?[\s-]?\d{3}[\s-]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, replacement: "[CARD]" },
  { pattern: /\b\d{15,16}\b/g, replacement: "[CARD]" },
  { pattern: /\d{4}[\s-]*[*Xx]{2,}[\s-]*[*Xx]{2,}[\s-]*\d{4}/g, replacement: "[CARD]" },
  { pattern: /[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*\d{4}/g, replacement: "[CARD]" },
  { pattern: /[*Xx]{1,4}[\s.-]*\d{4}/g, replacement: "[CARD]" },
];

const applyRedactionRule = (text: string, rule: RedactionRule): string =>
  text.replace(rule.pattern, rule.replacement);

const truncateEmailBody = (text: string): string => text.slice(0, 2000);
const EMAIL_PAYMENT_METHOD_LABEL_PATTERN = /m[eé]todo\s+de\s+pago/i;

const sanitizeEmailBody = (text: string): string =>
  truncateEmailBody(REDACTION_RULES.reduce(applyRedactionRule, text));

export function summarizeLlmEmailInputDiagnostics(input: {
  readonly rawText: string;
  readonly sanitizedText: string;
}) {
  return {
    rawLength: input.rawText.length,
    sanitizedLength: input.sanitizedText.length,
    wasTruncated:
      input.sanitizedText.length >= 2000 && input.rawText.length > input.sanitizedText.length,
    sanitizedHasPaymentMethodLabel: EMAIL_PAYMENT_METHOD_LABEL_PATTERN.test(input.sanitizedText),
    sanitizedCardPlaceholderCount: Array.from(input.sanitizedText.matchAll(/\[CARD\]/g)).length,
  };
}

function logLlmEmailInputDiagnostics(input: {
  readonly rawText: string;
  readonly sanitizedText: string;
}) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  const diagnostics = summarizeLlmEmailInputDiagnostics(input);
  if (
    !diagnostics.sanitizedHasPaymentMethodLabel &&
    diagnostics.sanitizedCardPlaceholderCount === 0
  ) {
    return;
  }

  console.info("[email-capture] llm_input_shape", diagnostics);
}

function sanitizeEmailBodyForLlm(text: string) {
  const sanitizedText = sanitizeEmailBody(text);
  logLlmEmailInputDiagnostics({ rawText: text, sanitizedText });
  return sanitizedText;
}

export const stripPii = (text: string): string => REDACTION_RULES.reduce(applyRedactionRule, text);

export const classifyMerchantApi = async (merchant: string): Promise<string> =>
  liveParseEmailService.classifyMerchant(merchant);

export const parseEmailApi = async (
  emailBody: string,
  options?: ParseEmailOptions
): Promise<LlmParsedTransaction | null> =>
  liveParseEmailService.parseEmail(sanitizeEmailBodyForLlm(emailBody), options);

export const retryableParseEmailApi = async (
  emailBody: string,
  options?: ParseEmailOptions
): Promise<LlmParsedTransaction | null> =>
  retryableParseEmailService.parseEmail(sanitizeEmailBodyForLlm(emailBody), options);
