import { anonymizeNotificationParseSample } from "../lib/notification-parse-improvement";
import type { NotificationData } from "../schema";
import type { RawParsedNotification } from "./notification-pipeline/types";

type ParsedNotificationRegexResult = {
  readonly kind: "parsed";
  readonly parsed: RawParsedNotification;
};

type FailedNotificationRegexResult = {
  readonly kind: "failed";
  readonly parserTemplate: string;
};

type UnsupportedNotificationRegexResult = {
  readonly kind: "unsupported";
};

export type NotificationRegexParseResult =
  | ParsedNotificationRegexResult
  | FailedNotificationRegexResult
  | UnsupportedNotificationRegexResult;

const KNOWN_REGEX_PACKAGES = new Set([
  "com.bbva.nxt_colombia",
  "com.rappi.card",
  "com.davivienda.daviplataapp",
]);

const PURCHASE_PATTERN =
  /\b(?:compra|purchase|pago|payment)\b(?:\s+aprobada|\s+aprobado|\s+realizada|\s+exitos[ao])?\s+(?:en|at)\s+(.+?)\s+(?:por|for)\s+(?:\$|COP)?\s*([\d.,]+)(?:\s+(?:el|on)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}))?/i;

const normalizeNotificationText = (text: string): string =>
  text
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseCopAmount = (rawAmount: string): number | null => {
  const amount = Number(rawAmount.replace(/[^\d]/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

const parseDate = (rawDate: string): string | null => {
  const match = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const rawDay = match[1];
  const rawMonth = match[2];
  const rawYear = match[3];
  if (!rawDay || !rawMonth || !rawYear) return null;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${rawMonth.padStart(2, "0")}-${rawDay.padStart(2, "0")}`;
};

const notificationDate = (notification: NotificationData): string =>
  new Date(notification.timestamp).toISOString().slice(0, 10);

const parseCardProductHint = (text: string): string | undefined => {
  const last4 = text.match(/\b(?:tarjeta|card)\s+(?:terminada\s+en\s+|[*xX]+\s*)?(\d{4})\b/i)?.[1];
  return last4 ? `tarjeta ${last4}` : undefined;
};

const parsePurchaseNotification = (
  text: string,
  notification: NotificationData
): RawParsedNotification | null => {
  const match = text.match(PURCHASE_PATTERN);
  const merchant = match?.[1]?.trim();
  const amount = match?.[2] ? parseCopAmount(match[2]) : null;
  const date = match?.[3] ? parseDate(match[3]) : notificationDate(notification);
  const cardProductHint = parseCardProductHint(text);
  return merchant && amount && date
    ? {
        type: "expense",
        amount,
        categoryId: "other",
        merchant,
        date,
        confidence: 0.92,
        counterpartyHint: merchant,
        ...(cardProductHint ? { cardProductHint } : {}),
      }
    : null;
};

export const parseNotificationWithRegex = (
  notification: NotificationData,
  rawText: string
): NotificationRegexParseResult => {
  if (!KNOWN_REGEX_PACKAGES.has(notification.packageName)) return { kind: "unsupported" };

  const normalizedText = normalizeNotificationText(rawText);
  const parsed = parsePurchaseNotification(normalizedText, notification);
  return parsed
    ? { kind: "parsed", parsed }
    : { kind: "failed", parserTemplate: anonymizeNotificationParseSample(normalizedText) };
};
