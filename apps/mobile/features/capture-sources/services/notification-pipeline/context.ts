import type { CaptureEvidenceSeed } from "@/features/capture-evidence/public";
import {
  buildNotificationCaptureEvidence,
  buildNotificationTypedLlmHintCaptureEvidence,
} from "@/features/capture-evidence/public";
import { stripPii } from "@/features/email-capture/parsing.public";
import { isValidCategoryId } from "@/features/transactions/write.public";
import { toIsoDate, toIsoDateTime } from "@/shared/lib";
import { assertCopAmount, assertIsoDate } from "@/shared/types/assertions";
import type { CategoryId, FinancialAccountId } from "@/shared/types/branded";
import { captureFingerprint } from "../../lib/dedup";
import type { NotificationData } from "../../schema";
import { resolveSource } from "../../schema";
import { parseNotificationApi, type ParseNotificationApiResult } from "../parse-notification-api";
import type {
  NotificationCommand,
  NotificationContext,
  ParsedNotification,
  RawNotificationAiUnavailable,
  RawNotificationNeedsReview,
  RawParsedNotification,
} from "./types";

export function isRawNotificationNeedsReview(
  parsed: RawParsedNotification | RawNotificationNeedsReview | RawNotificationAiUnavailable
): parsed is RawNotificationNeedsReview {
  return "kind" in parsed && parsed.kind === "needs_review";
}

export function isRawNotificationAiUnavailable(
  parsed: RawParsedNotification | RawNotificationNeedsReview | RawNotificationAiUnavailable
): parsed is RawNotificationAiUnavailable {
  return "kind" in parsed && parsed.kind === "ai_unavailable";
}

function isNeedsReviewNotificationParse(
  llm: ParseNotificationApiResult
): llm is RawNotificationNeedsReview {
  return llm !== null && "kind" in llm && llm.kind === "needs_review";
}

function isAiUnavailableNotificationParse(
  llm: ParseNotificationApiResult
): llm is RawNotificationAiUnavailable {
  return llm !== null && "kind" in llm && llm.kind === "ai_unavailable";
}

export function buildNotificationFingerprint(
  context: NotificationContext,
  parsed: ParsedNotification
) {
  return captureFingerprint({
    source: context.source,
    amount: parsed.amount,
    date: parsed.date,
    merchant: parsed.merchant,
  });
}

export function normalizeParsedNotification(parsed: RawParsedNotification): ParsedNotification {
  assertCopAmount(parsed.amount);
  assertIsoDate(parsed.date);

  return {
    ...parsed,
    amount: parsed.amount,
    date: parsed.date,
  };
}

export async function parseNotificationWithLlm(
  sanitizedText: string
): Promise<
  RawParsedNotification | RawNotificationNeedsReview | RawNotificationAiUnavailable | null
> {
  const llm = await parseNotificationApi(sanitizedText);

  if (isNeedsReviewNotificationParse(llm)) {
    return llm;
  }
  if (isAiUnavailableNotificationParse(llm)) {
    return llm;
  }

  return llm
    ? {
        amount: llm.amount,
        merchant: llm.description,
        type: llm.type,
        categoryId: llm.categoryId,
        date: llm.date,
        confidence: llm.confidence,
        cardProductHint: llm.cardProductHint,
        accountTypeHint: llm.accountTypeHint,
        counterpartyHint: llm.counterpartyHint,
      }
    : null;
}

export function appendParsedNotificationEvidence(
  context: NotificationContext,
  parsed: ParsedNotification
): NotificationContext {
  return {
    ...context,
    captureEvidence: [
      ...context.captureEvidence,
      ...buildNotificationTypedLlmHintCaptureEvidence({
        notification: context.notification,
        cardProductHint: parsed.cardProductHint,
        accountTypeHint: parsed.accountTypeHint,
        counterpartyHint: parsed.counterpartyHint,
      }),
    ],
  };
}

export function normalizeNotificationCommand(
  command: NotificationCommand,
  buildEvidence: (
    notification: NotificationData
  ) => readonly CaptureEvidenceSeed[] = buildNotificationCaptureEvidence
): NotificationContext {
  const notificationText = command.notification.bigText ?? command.notification.text;

  return {
    ...command,
    captureEvidence: buildEvidence(command.notification),
    notificationText,
    sanitizedText: stripPii(notificationText).slice(0, 500),
    receivedAt: toIsoDateTime(new Date(command.notification.timestamp)),
    source: resolveSource(command.notification.packageName),
    notificationDate: toIsoDate(new Date(command.notification.timestamp)),
  };
}

export function resolveCategoryId(rawCategoryId: string): CategoryId {
  if (isValidCategoryId(rawCategoryId)) {
    return rawCategoryId;
  }

  throw new Error("Invalid notification category");
}

export function selectAccountResolution(
  matchedAccountId: FinancialAccountId | null,
  defaultAccountId: FinancialAccountId
) {
  return {
    accountId: matchedAccountId ?? defaultAccountId,
    accountAttributionState: matchedAccountId ? "inferred" : "unresolved",
  } as const;
}

export function buildFailedFingerprint(notification: NotificationData) {
  return `failed:${notification.packageName}:${notification.timestamp}`;
}
