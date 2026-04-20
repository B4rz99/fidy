import { findMatchingFinancialAccountId } from "@/features/account-suggestions";
import type { CaptureEvidenceSeed } from "@/features/capture-evidence";
import {
  buildNotificationCaptureEvidence,
  materializeCaptureEvidenceRows,
  saveCaptureEvidenceRows,
} from "@/features/capture-evidence";
import {
  insertMerchantRule,
  lookupMerchantRule,
} from "@/features/email-capture/merchant-rules.public";
import { stripPii } from "@/features/email-capture/parsing.public";
import { ensureDefaultFinancialAccount } from "@/features/financial-accounts";
import { insertTransaction, isValidCategoryId } from "@/features/transactions/write.public";
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db";
import {
  capturePipelineEvent,
  generateProcessedCaptureId,
  generateSyncQueueId,
  generateTransactionId,
  normalizeMerchant,
  toIsoDate,
  toIsoDateTime,
  trackTransactionCreated,
} from "@/shared/lib";
import { assertCopAmount, assertIsoDate, assertUserId } from "@/shared/types/assertions";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";
import { captureFingerprint, findDuplicateTransaction, isCaptureProcessed } from "../lib/dedup";
import { parseNotificationLocally } from "../lib/notification-parser";
import { insertProcessedCapture } from "../lib/repository";
import type { NotificationData } from "../schema";
import { resolveSource } from "../schema";
import { parseNotificationApi } from "./parse-notification-api";

/** In-flight fingerprints guard against concurrent duplicate processing. */
const inFlightFingerprints = new Set<string>();
const FALLBACK_CATEGORY_ID = "other";

type NotificationParseMethod = "regex" | "llm";
type NotificationSource = ReturnType<typeof resolveSource>;
type NotificationStageMetrics = {
  saved: 0 | 1;
  skippedDuplicate: 0 | 1;
  parseFailed: 0 | 1;
};
type ParsedNotificationCandidate = {
  amount: number;
  merchant: string;
  type: "expense" | "income";
  categoryId: string;
  date: string;
  confidence: number;
};
type ParsedNotification = Omit<ParsedNotificationCandidate, "amount" | "date"> & {
  amount: CopAmount;
  date: IsoDate;
};
type NotificationCommand = {
  db: AnyDb;
  userId: UserId;
  notification: NotificationData;
};
type NotificationContext = NotificationCommand & {
  captureEvidence: readonly CaptureEvidenceSeed[];
  notificationText: string;
  sanitizedText: string;
  receivedAt: IsoDateTime;
  source: NotificationSource;
  notificationDate: IsoDate;
};
type NotificationStageContext = NotificationContext & {
  parseMethod: NotificationParseMethod;
};
type ParsedNotificationContext = NotificationStageContext & {
  parsed: ParsedNotification;
  fingerprint: string;
};
type ResolvedNotificationContext = ParsedNotificationContext & {
  merchantKey: string;
  categoryId: CategoryId;
  accountId: FinancialAccountId;
  accountAttributionState: "inferred" | "unresolved";
  now: IsoDateTime;
};
type ParseStageResult =
  | { kind: "failed"; context: NotificationStageContext }
  | { kind: "parsed"; context: ParsedNotificationContext };
type DuplicateCheckResult =
  | { kind: "already_processed" }
  | { kind: "cross_source"; transactionId: TransactionId };
type PersistedCaptureOutcome = {
  status: "failed" | "skipped_duplicate" | "success";
  fingerprintHash: string;
  transactionId: TransactionId | null;
  confidence: number | null;
  now: IsoDateTime;
};

export type NotificationPipelineResult = {
  saved: boolean;
  skippedDuplicate: boolean;
  transactionId: TransactionId | null;
};

export async function processNotification(
  db: AnyDb,
  userId: string,
  notification: NotificationData
): Promise<NotificationPipelineResult> {
  assertUserId(userId);
  const context = normalizeNotificationCommand({ db, userId, notification });
  const parseStage = await parseNotificationStage(context);

  if (parseStage.kind === "failed") {
    return persistFailedNotification(parseStage.context);
  }

  return withFingerprintLock(parseStage.context, handleParsedNotification);
}

async function parseNotificationStage(context: NotificationContext): Promise<ParseStageResult> {
  const localResult = parseNotificationLocally(context.notificationText);
  const parseMethod: NotificationParseMethod = localResult ? "regex" : "llm";
  const parsed: ParsedNotificationCandidate | null = localResult
    ? {
        ...localResult,
        categoryId: FALLBACK_CATEGORY_ID,
        date: context.notificationDate,
        confidence: 0.8,
      }
    : await parseNotificationWithLlm(context.sanitizedText);
  if (!parsed) {
    return { kind: "failed", context: { ...context, parseMethod } };
  }
  assertCopAmount(parsed.amount);
  assertIsoDate(parsed.date);
  const validatedParsed: ParsedNotification = {
    ...parsed,
    amount: parsed.amount,
    date: parsed.date,
  };
  const fingerprint = buildNotificationFingerprint(context, validatedParsed);
  return {
    kind: "parsed",
    context: {
      ...context,
      parseMethod,
      parsed: validatedParsed,
      fingerprint,
    },
  };
}

function buildNotificationFingerprint(context: NotificationContext, parsed: ParsedNotification) {
  return captureFingerprint(context.source, parsed.amount, parsed.date, parsed.merchant);
}

async function parseNotificationWithLlm(
  sanitizedText: string
): Promise<ParsedNotificationCandidate | null> {
  const llm = await parseNotificationApi(sanitizedText);

  return llm
    ? {
        amount: llm.amount,
        merchant: llm.description,
        type: llm.type,
        categoryId: llm.categoryId,
        date: llm.date,
        confidence: llm.confidence,
      }
    : null;
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
  if (await isCaptureProcessed(context.db, context.fingerprint)) {
    return { kind: "already_processed" };
  }

  const transactionId = await findDuplicateTransaction(
    context.db,
    context.userId,
    context.parsed.amount,
    context.parsed.date,
    context.parsed.merchant
  );

  return transactionId ? { kind: "cross_source", transactionId } : null;
}

async function persistFailedNotification(
  context: NotificationStageContext
): Promise<NotificationPipelineResult> {
  const now = toIsoDateTime(new Date());

  await persistCaptureOutcome(context, {
    status: "failed",
    fingerprintHash: buildFailedFingerprint(context.notification),
    transactionId: null,
    confidence: null,
    now,
  });
  trackNotificationPipeline(context, {
    saved: 0,
    skippedDuplicate: 0,
    parseFailed: 1,
  });

  return { saved: false, skippedDuplicate: false, transactionId: null };
}

async function persistDuplicateNotification(
  context: ParsedNotificationContext,
  duplicate: DuplicateCheckResult
): Promise<NotificationPipelineResult> {
  if (duplicate.kind === "already_processed") {
    return reportSkippedDuplicate(context, null);
  }

  await persistCaptureOutcome(context, {
    status: "skipped_duplicate",
    fingerprintHash: context.fingerprint,
    transactionId: duplicate.transactionId,
    confidence: context.parsed.confidence,
    now: toIsoDateTime(new Date()),
  });

  return reportSkippedDuplicate(context, duplicate.transactionId);
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

async function persistSuccessfulNotification(
  context: ResolvedNotificationContext
): Promise<NotificationPipelineResult> {
  const transactionId = saveTransactionRecord(context);

  await persistCaptureOutcome(context, {
    status: "success",
    fingerprintHash: context.fingerprint,
    transactionId,
    confidence: context.parsed.confidence,
    now: context.now,
  });
  await cacheMerchantRuleIfEligible(context);
  await trackSuccessfulNotification(context);

  return { saved: true, skippedDuplicate: false, transactionId };
}

async function persistCaptureOutcome(
  context: NotificationContext,
  outcome: PersistedCaptureOutcome
) {
  const processedCaptureId = generateProcessedCaptureId();

  await insertProcessedCapture(context.db, {
    id: processedCaptureId,
    fingerprintHash: outcome.fingerprintHash,
    source: context.source,
    status: outcome.status,
    rawText: context.sanitizedText,
    transactionId: outcome.transactionId,
    confidence: outcome.confidence,
    receivedAt: context.receivedAt,
    createdAt: outcome.now,
  });

  saveCaptureEvidenceRows(
    context.db,
    materializeCaptureEvidenceRows(context.captureEvidence, {
      userId: context.userId,
      transactionId: outcome.transactionId,
      processedEmailId: null,
      processedCaptureId,
      createdAt: outcome.now,
      updatedAt: outcome.now,
    })
  );
}

async function cacheMerchantRuleIfEligible(context: ResolvedNotificationContext) {
  if (context.parsed.confidence < 0.7) {
    return;
  }

  await insertMerchantRule(
    context.db,
    context.userId,
    context.merchantKey,
    context.categoryId,
    context.now
  );
}

function normalizeNotificationCommand(command: NotificationCommand): NotificationContext {
  const notificationText = command.notification.bigText ?? command.notification.text;

  return {
    ...command,
    captureEvidence: buildNotificationCaptureEvidence(command.notification),
    notificationText,
    sanitizedText: stripPii(notificationText).slice(0, 500),
    receivedAt: toIsoDateTime(new Date(command.notification.timestamp)),
    source: resolveSource(command.notification.packageName),
    notificationDate: toIsoDate(new Date(command.notification.timestamp)),
  };
}

function resolveCategoryId(rawCategoryId: string): CategoryId {
  if (isValidCategoryId(rawCategoryId)) {
    return rawCategoryId;
  }

  if (!isValidCategoryId(FALLBACK_CATEGORY_ID)) {
    throw new Error("Missing fallback category");
  }

  return FALLBACK_CATEGORY_ID;
}

async function reportSkippedDuplicate(
  context: NotificationStageContext,
  transactionId: TransactionId | null
): Promise<NotificationPipelineResult> {
  trackNotificationPipeline(context, {
    saved: 0,
    skippedDuplicate: 1,
    parseFailed: 0,
  });

  return { saved: false, skippedDuplicate: true, transactionId };
}

function selectAccountResolution(
  matchedAccountId: FinancialAccountId | null,
  defaultAccountId: FinancialAccountId
) {
  return {
    accountId: matchedAccountId ?? defaultAccountId,
    accountAttributionState: matchedAccountId ? "inferred" : "unresolved",
  } as const;
}

async function trackSuccessfulNotification(context: ResolvedNotificationContext) {
  trackTransactionCreated({
    type: context.parsed.type,
    category: String(context.categoryId),
    source: "notification",
  });

  trackNotificationPipeline(context, {
    saved: 1,
    skippedDuplicate: 0,
    parseFailed: 0,
  });
}

function trackNotificationPipeline(
  context: NotificationStageContext,
  metrics: NotificationStageMetrics
) {
  capturePipelineEvent({
    source: "notification",
    bankSource: context.source,
    parseMethod: context.parseMethod,
    ...metrics,
  });
}

function buildFailedFingerprint(notification: NotificationData) {
  return `failed:${notification.packageName}:${notification.timestamp}`;
}

function saveTransactionRecord(context: ResolvedNotificationContext): TransactionId {
  const transactionId = generateTransactionId();
  const syncQueueId = generateSyncQueueId();

  insertTransaction(context.db, {
    id: transactionId,
    userId: context.userId,
    type: context.parsed.type,
    amount: context.parsed.amount,
    categoryId: context.categoryId,
    description: context.parsed.merchant,
    date: context.parsed.date,
    accountId: context.accountId,
    accountAttributionState: context.accountAttributionState,
    source: context.source,
    createdAt: context.now,
    updatedAt: context.now,
  });

  enqueueSync(context.db, {
    id: syncQueueId,
    tableName: "transactions",
    rowId: transactionId,
    operation: "insert",
    createdAt: context.now,
  });

  return transactionId;
}
