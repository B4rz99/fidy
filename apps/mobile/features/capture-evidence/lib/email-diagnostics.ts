import { htmlToPlainText } from "@/shared/lib/html-to-text";

const EMAIL_LAST4_PATTERNS = [
  /(?:m[eé]todo\s+de\s+pago)\D{0,48}(?:\*{1,4}|x{2,4})[\s.-]*(\d{4})\b/gi,
] as const;
const EMAIL_PAYMENT_METHOD_LABEL_PATTERN = /m[eé]todo\s+de\s+pago/i;

export function summarizeEmailEvidenceInputDiagnostics(input: {
  readonly family: string;
  readonly rawText: string;
}) {
  const evidenceText = htmlToPlainText(input.rawText);
  return {
    sourceFamily: input.family,
    bodyLength: input.rawText.length,
    evidenceTextLength: evidenceText.length,
    hasPaymentMethodLabel: EMAIL_PAYMENT_METHOD_LABEL_PATTERN.test(evidenceText),
    maskedPaymentMethodMatchCount: EMAIL_LAST4_PATTERNS.reduce(
      (count, pattern) => count + Array.from(evidenceText.matchAll(pattern)).length,
      0
    ),
  };
}

export function logEmailEvidenceInputDiagnostics(input: {
  readonly family: string;
  readonly rawText: string;
}) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  const diagnostics = summarizeEmailEvidenceInputDiagnostics(input);
  if (!diagnostics.hasPaymentMethodLabel && diagnostics.maskedPaymentMethodMatchCount === 0) return;

  console.info("[capture-evidence] email_input_shape", diagnostics);
}
