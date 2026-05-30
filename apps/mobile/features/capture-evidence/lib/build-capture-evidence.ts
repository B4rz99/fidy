import type {
  ApplePayIntentData,
  NotificationData,
} from "@/features/capture-sources/schema.public";
import { KNOWN_BANK_PACKAGES } from "@/features/capture-sources/schema.public";
import { extractEmailDomain, htmlToPlainText } from "@/shared/lib.public";
import type { CaptureEvidenceSeed } from "../schema";

export { summarizeEmailEvidenceInputDiagnostics } from "./email-diagnostics";

const ALIAS_TOKENS = [
  "ahorros",
  "corriente",
  "credito",
  "debito",
  "nomina",
  "visa",
  "mastercard",
  "amex",
] as const;

const LAST4_PATTERNS = [
  /(?:\*{1,4}|x{2,4})[\s.-]*(\d{4})\b/gi,
  /(?:tarjeta|card|cuenta|cta\.?|account|ending in|terminad[ao] en)\D{0,16}(\d{4})\b/gi,
] as const;

const EMAIL_LAST4_PATTERNS = [
  /(?:m[eé]todo\s+de\s+pago)\D{0,48}(?:\*{1,4}|x{2,4})[\s.-]*(\d{4})\b/gi,
] as const;
type EmailCaptureInput = {
  readonly from: string;
  readonly body?: string;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
};

function normalizeWhitespace(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeFamily(value: string) {
  return normalizeWhitespace(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeHint(value: string) {
  return normalizeWhitespace(value).replace(/\s+/g, " ");
}

type TypedLlmHint = {
  readonly evidenceType: "card_product_hint" | "account_type_hint" | "counterparty_hint";
  readonly value: string;
};

function buildLlmAccountHintCaptureEvidence(input: {
  readonly family: string;
  readonly scopePrefix: "email" | "notification";
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
}): readonly CaptureEvidenceSeed[] {
  const legacyHints = [input.fromAccountHint, input.toAccountHint]
    .filter((hint): hint is string => hint != null && hint.trim().length > 0)
    .map(normalizeHint)
    .map((hint) => ({
      sourceFamily: input.family,
      evidenceType: "llm_account_hint" as const,
      scope: `${input.scopePrefix}:${input.family}:llm_account_hint`,
      value: hint,
    }));
  const typedHints = [
    { evidenceType: "card_product_hint" as const, value: input.cardProductHint },
    { evidenceType: "account_type_hint" as const, value: input.accountTypeHint },
    { evidenceType: "counterparty_hint" as const, value: input.counterpartyHint },
  ]
    .filter((hint): hint is TypedLlmHint => hint.value != null && hint.value.trim().length > 0)
    .map((hint) => ({
      sourceFamily: input.family,
      evidenceType: hint.evidenceType,
      scope: `${input.scopePrefix}:${input.family}:${hint.evidenceType}`,
      value: normalizeHint(hint.value),
    }));

  return [...legacyHints, ...typedHints];
}

function uniqueEvidence(rows: readonly CaptureEvidenceSeed[]) {
  return Array.from(new Map(rows.map((row) => [`${row.scope}:${row.value}`, row])).values());
}

function familyFromDomain(domain: string) {
  const parts = domain.split(".").filter(Boolean);
  return normalizeFamily(parts[0] ?? domain);
}

function familyFromPackageName(packageName: string) {
  const knownPackage = KNOWN_BANK_PACKAGES.find((entry) => entry.packageName === packageName);
  if (knownPackage) {
    return normalizeFamily(knownPackage.label);
  }

  const parts = packageName.toLowerCase().split(".").filter(Boolean);
  return normalizeFamily(parts.at(-1) ?? packageName);
}

function extractAliasEvidence(
  family: string,
  combinedText: string
): readonly CaptureEvidenceSeed[] {
  const toAliasEvidence = (token: string): CaptureEvidenceSeed => ({
    sourceFamily: family,
    evidenceType: "alias_token",
    scope: `notification:${family}:alias`,
    value: token,
  });

  return ALIAS_TOKENS.flatMap((token) =>
    combinedText.includes(token) ? [toAliasEvidence(token)] : []
  );
}

function extractLast4Evidence(input: {
  readonly scopePrefix: string;
  readonly family: string;
  readonly rawText: string;
}) {
  const values = LAST4_PATTERNS.flatMap((pattern) =>
    Array.from(input.rawText.matchAll(pattern), (match) => match[1] ?? "").flatMap((value) =>
      value.length === 4
        ? [
            {
              sourceFamily: input.family,
              evidenceType: "last4" as const,
              scope: `${input.scopePrefix}:${input.family}:last4`,
              value,
            },
          ]
        : []
    )
  );

  return uniqueEvidence(values);
}

function extractEmailLast4Evidence(input: { readonly family: string; readonly rawText: string }) {
  const evidenceText = htmlToPlainText(input.rawText);
  const values = EMAIL_LAST4_PATTERNS.flatMap((pattern) =>
    Array.from(evidenceText.matchAll(pattern), (match) => match[1] ?? "").flatMap((value) =>
      value.length === 4
        ? [
            {
              sourceFamily: input.family,
              evidenceType: "last4" as const,
              scope: `email:${input.family}:last4`,
              value,
            },
          ]
        : []
    )
  );

  return uniqueEvidence(values);
}

function buildEmailSenderEvidence(input: {
  readonly family: string;
  readonly senderEmail: string;
  readonly senderDomain: string;
}): readonly CaptureEvidenceSeed[] {
  return [
    {
      sourceFamily: input.family,
      evidenceType: "sender_email",
      scope: `email:${input.family}:sender`,
      value: input.senderEmail,
    },
    {
      sourceFamily: input.family,
      evidenceType: "sender_domain",
      scope: `email:${input.family}:domain`,
      value: input.senderDomain,
    },
  ];
}

export function buildEmailCaptureEvidence(
  input: EmailCaptureInput
): readonly CaptureEvidenceSeed[] {
  const senderEmail = normalizeWhitespace(input.from);
  const senderDomain = extractEmailDomain(senderEmail);
  const family = familyFromDomain(senderDomain);
  const body = input.body ?? "";

  return uniqueEvidence([
    ...buildEmailSenderEvidence({ family, senderEmail, senderDomain }),
    ...buildLlmAccountHintCaptureEvidence({
      family,
      scopePrefix: "email",
      fromAccountHint: input.fromAccountHint,
      toAccountHint: input.toAccountHint,
      cardProductHint: input.cardProductHint,
      accountTypeHint: input.accountTypeHint,
      counterpartyHint: input.counterpartyHint,
    }),
    ...extractEmailLast4Evidence({ family, rawText: body }),
  ]);
}

export function buildNotificationLlmAccountHintCaptureEvidence(input: {
  readonly notification: NotificationData;
  readonly fromAccountHint?: string;
  readonly toAccountHint?: string;
  readonly cardProductHint?: string;
  readonly accountTypeHint?: string;
  readonly counterpartyHint?: string;
}): readonly CaptureEvidenceSeed[] {
  return buildLlmAccountHintCaptureEvidence({
    family: familyFromPackageName(input.notification.packageName),
    scopePrefix: "notification",
    fromAccountHint: input.fromAccountHint,
    toAccountHint: input.toAccountHint,
    cardProductHint: input.cardProductHint,
    accountTypeHint: input.accountTypeHint,
    counterpartyHint: input.counterpartyHint,
  });
}

export function buildNotificationCaptureEvidence(
  notification: NotificationData
): readonly CaptureEvidenceSeed[] {
  const family = familyFromPackageName(notification.packageName);
  const combinedText = normalizeWhitespace(
    [
      notification.title,
      notification.subText,
      notification.bigText,
      notification.text,
      notification.packageName,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return uniqueEvidence([
    {
      sourceFamily: family,
      evidenceType: "package_name",
      scope: `notification:${family}:package`,
      value: notification.packageName.toLowerCase(),
    },
    ...extractAliasEvidence(family, combinedText),
    ...extractLast4Evidence({ scopePrefix: "notification", family, rawText: combinedText }),
  ]);
}

export function buildApplePayCaptureEvidence(
  intent: ApplePayIntentData
): readonly CaptureEvidenceSeed[] {
  if (!intent.card) {
    return [];
  }

  const cardHint = normalizeWhitespace(intent.card);
  const family = "apple_pay";

  return uniqueEvidence([
    {
      sourceFamily: family,
      evidenceType: "card_hint",
      scope: "apple_pay:card_hint",
      value: cardHint,
    },
    ...extractLast4Evidence({ scopePrefix: "apple_pay", family: "", rawText: cardHint }).map(
      (row) => ({
        ...row,
        sourceFamily: family,
        scope: "apple_pay:last4",
      })
    ),
  ]);
}
