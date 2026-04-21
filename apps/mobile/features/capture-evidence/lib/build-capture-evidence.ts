import type { ApplePayIntentData, NotificationData } from "@/features/capture-sources/schema";
import { KNOWN_BANK_PACKAGES } from "@/features/capture-sources/schema";
import { extractDomain } from "@/features/email-capture/lib/bank-senders";
import type { CaptureEvidenceSeed } from "../schema";

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

type EmailCaptureInput = {
  readonly from: string;
};

function normalizeWhitespace(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeFamily(value: string) {
  return normalizeWhitespace(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
  return ALIAS_TOKENS.filter((token) => combinedText.includes(token)).map((token) => ({
    sourceFamily: family,
    evidenceType: "alias_token",
    scope: `notification:${family}:alias`,
    value: token,
  }));
}

function extractLast4Evidence(input: {
  readonly scopePrefix: string;
  readonly family: string;
  readonly rawText: string;
}) {
  const values = LAST4_PATTERNS.flatMap((pattern) =>
    Array.from(input.rawText.matchAll(pattern), (match) => match[1] ?? "")
  )
    .filter((value) => value.length === 4)
    .map((value) => ({
      sourceFamily: input.family,
      evidenceType: "last4" as const,
      scope: `${input.scopePrefix}:${input.family}:last4`,
      value,
    }));

  return uniqueEvidence(values);
}

export function buildEmailCaptureEvidence(
  input: EmailCaptureInput
): readonly CaptureEvidenceSeed[] {
  const senderEmail = normalizeWhitespace(input.from);
  const senderDomain = extractDomain(senderEmail);
  const family = familyFromDomain(senderDomain);

  return uniqueEvidence([
    {
      sourceFamily: family,
      evidenceType: "sender_email",
      scope: `email:${family}:sender`,
      value: senderEmail,
    },
    {
      sourceFamily: family,
      evidenceType: "sender_domain",
      scope: `email:${family}:domain`,
      value: senderDomain,
    },
  ]);
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
