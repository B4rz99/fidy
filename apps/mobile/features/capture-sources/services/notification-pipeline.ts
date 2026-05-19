import { findMatchingFinancialAccountId } from "@/features/account-suggestions/public";
import { lookupMerchantRule } from "@/features/email-capture/merchant-rules.public";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/public";
import type { AnyDb } from "@/shared/db";
import { captureWarning, normalizeMerchant, toIsoDateTime } from "@/shared/lib";
import { assertUserId } from "@/shared/types/assertions";
import type { CategoryId } from "@/shared/types/branded";
import { findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import { parseNotificationLocalHint } from "../lib/notification-parser";
import type { NotificationData } from "../schema";
import { parseNotificationWithRegex } from "./notification-regex-parser";
import {
  appendParsedNotificationEvidence,
  buildNotificationFingerprint,
  normalizeNotificationCommand,
  normalizeParsedNotification,
  parseNotificationWithLlm,
  resolveCategoryId,
  selectAccountResolution,
} from "./notification-pipeline/context";
import {
  persistDuplicateNotification,
  persistFailedNotification,
  persistSuccessfulNotification,
  reportSkippedDuplicate,
} from "./notification-pipeline/outcomes";
import type {
  DuplicateCheckResult,
  NotificationContext,
  NotificationPipelineResult,
  ParsedNotificationContext,
  ParseStageResult,
  ResolvedNotificationContext,
} from "./notification-pipeline/types";

export type { NotificationPipelineResult } from "./notification-pipeline/types";

/** In-flight fingerprints guard against concurrent duplicate processing. */
const inFlightFingerprints = new Set<string>();

export async function processNotification(
  db: AnyDb,
  userId: string,
  notification: NotificationData
): Promise<NotificationPipelineResult> {
  assertUserId(userId);
  const context = normalizeNotificationCommand({ db, userId, notification });

  try {
    const parseStage = await parseNotificationStage(context);

    if (parseStage.kind === "failed") {
      return persistFailedNotification(parseStage.context);
    }

    return withFingerprintLock(parseStage.context, handleParsedNotification);
  } catch (error) {
    captureWarning("notification_pipeline_exception", {
      bankSource: context.source,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}

async function parseNotificationStage(context: NotificationContext): Promise<ParseStageResult> {
  const regexParse = parseNotificationWithRegex(context.notification, context.notificationText);
  if (regexParse.kind === "parsed") {
    const parsed = normalizeParsedNotification(regexParse.parsed);
    const parsedContext = appendParsedNotificationEvidence(context, parsed);
    const fingerprint = buildNotificationFingerprint(context, parsed);
    return {
      kind: "parsed",
      context: {
        ...parsedContext,
        parseMethod: "regex",
        parsed,
        fingerprint,
      },
    };
  }

  const localHint = parseNotificationLocalHint(context.notificationText);
  const rawParsed = await parseNotificationWithLlm(
    buildNotificationLlmInput(context.sanitizedText, localHint)
  );
  if (!rawParsed) {
    return {
      kind: "failed",
      context: {
        ...context,
        parseMethod: "llm",
        ...(regexParse.kind === "failed"
          ? { regexParseImprovementTemplate: regexParse.parserTemplate }
          : {}),
      },
    };
  }
  const parsed = normalizeParsedNotification(rawParsed);
  const parsedContext = appendParsedNotificationEvidence(context, parsed);
  const fingerprint = buildNotificationFingerprint(context, parsed);
  return {
    kind: "parsed",
    context: {
      ...parsedContext,
      parseMethod: "llm",
      ...(regexParse.kind === "failed"
        ? { regexParseImprovementTemplate: regexParse.parserTemplate }
        : {}),
      parsed,
      fingerprint,
    },
  };
}

function buildNotificationLlmInput(
  sanitizedText: string,
  localHint: ReturnType<typeof parseNotificationLocalHint>
) {
  if (!localHint) return sanitizedText;

  return [
    "Local regex hints (not authoritative):",
    `type=${localHint.type}`,
    "",
    sanitizedText,
  ].join("\n");
}

async function withFingerprintLock(
  context: ParsedNotificationContext,
  run: (context: ParsedNotificationContext) => Promise<NotificationPipelineResult>
): Promise<NotificationPipelineResult> {
  if (inFlightFingerprints.has(context.fingerprint)) {
    return reportSkippedDuplicate(context, null);
  }

  inFlightFingerprints.add(context.fingerprint);

  try {
    return await run(context);
  } finally {
    inFlightFingerprints.delete(context.fingerprint);
  }
}

async function handleParsedNotification(
  context: ParsedNotificationContext
): Promise<NotificationPipelineResult> {
  const duplicate = await findDuplicateCapture(context);

  if (duplicate) {
    return persistDuplicateNotification(context, duplicate);
  }

  const resolved = await resolveTransactionContext(context);
  return persistSuccessfulNotification(resolved);
}

async function findDuplicateCapture(
  context: ParsedNotificationContext
): Promise<DuplicateCheckResult | null> {
  if (
    await isCaptureProcessed({
      db: context.db,
      userId: context.userId,
      sourceFamily: context.source,
      sourceId: context.source,
      sourceEventId: context.fingerprint,
    })
  ) {
    return { kind: "already_processed" };
  }

  const transactionId = await findDuplicateTransaction({
    db: context.db,
    userId: context.userId,
    amount: context.parsed.amount,
    date: context.parsed.date,
    merchant: context.parsed.merchant,
  });

  return transactionId ? { kind: "cross_source", transactionId } : null;
}

async function resolveTransactionContext(
  context: ParsedNotificationContext
): Promise<ResolvedNotificationContext> {
  const merchantKey = normalizeMerchant(context.parsed.merchant);
  const now = toIsoDateTime(new Date());
  const categoryId = await resolveParsedCategoryId(context, merchantKey);
  const matchedAccountId = findMatchingFinancialAccountId(
    context.db,
    context.userId,
    context.captureEvidence
  );
  const defaultAccount = ensureDefaultFinancialAccount(context.db, context.userId, { now });
  const accountResolution = selectAccountResolution(matchedAccountId, defaultAccount.id);

  return {
    ...context,
    merchantKey,
    categoryId,
    ...accountResolution,
    now,
  };
}

async function resolveParsedCategoryId(
  context: ParsedNotificationContext,
  merchantKey: string
): Promise<CategoryId> {
  const cachedCategoryId = await lookupMerchantRule(context.db, context.userId, merchantKey);
  return resolveCategoryId(cachedCategoryId ?? context.parsed.categoryId);
}
