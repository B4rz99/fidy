import { enqueueSync, insertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import type { BankSender } from "../lib/bank-senders";
import { isBankSender } from "../lib/bank-senders";
import { insertMerchantRule, lookupMerchantRule } from "../lib/merchant-rules";
import { getProcessedExternalIds, insertProcessedEmail } from "../lib/repository";
import type { RawEmail } from "../schema";
import { type LlmParsedTransaction, llmOutputSchema } from "./llm-parser";
import { parseEmailApi } from "./parse-email-api";

export type PipelineResult = {
  filtered: number;
  skippedDuplicate: number;
  saved: number;
  failed: number;
  needsReview: number;
};

/**
 * Extract a keyword from the email subject for merchant rule matching.
 * Uses first 3 words of the subject, lowercased and trimmed.
 */
function extractKeyword(subject: string): string {
  return subject.split(/\s+/).slice(0, 3).join(" ").toLowerCase().trim();
}

async function parseEmail(
  db: AnyDb,
  userId: string,
  email: RawEmail
): Promise<LlmParsedTransaction | null> {
  const keyword = extractKeyword(email.subject);
  const cachedCategoryId = await lookupMerchantRule(db, userId, email.from, keyword);
  const llmResult = await parseEmailApi(email.body);
  if (!llmResult) return null;

  if (cachedCategoryId) {
    return { ...llmResult, categoryId: cachedCategoryId, confidence: 1.0 };
  }

  return llmResult;
}

async function saveTransaction(
  db: AnyDb,
  userId: string,
  validated: LlmParsedTransaction,
  email: RawEmail,
  status: "success" | "needs_review"
): Promise<string> {
  const source = email.provider === "gmail" ? "email_gmail" : "email_outlook";
  const txId = generateId("tx");
  const now = new Date().toISOString();

  await insertTransaction(db, {
    id: txId,
    userId,
    type: validated.type,
    amountCents: validated.amountCents,
    categoryId: validated.categoryId,
    description: validated.description,
    date: validated.date,
    source,
    createdAt: now,
    updatedAt: now,
  });

  await enqueueSync(db, {
    id: generateId("sq"),
    tableName: "transactions",
    rowId: txId,
    operation: "insert",
    createdAt: now,
  });

  await insertProcessedEmail(db, {
    id: generateId("pe"),
    externalId: email.externalId,
    provider: email.provider,
    status,
    failureReason: null,
    subject: email.subject,
    rawBodyPreview: email.body.slice(0, 500),
    receivedAt: email.receivedAt,
    transactionId: txId,
    confidence: validated.confidence,
    createdAt: now,
  });

  return txId;
}

export async function processEmails(
  db: AnyDb,
  userId: string,
  rawEmails: RawEmail[],
  senders: readonly BankSender[]
): Promise<PipelineResult> {
  const result: PipelineResult = {
    filtered: 0,
    skippedDuplicate: 0,
    saved: 0,
    failed: 0,
    needsReview: 0,
  };

  const allExternalIds = rawEmails.map((e) => e.externalId);
  const processedIds = await getProcessedExternalIds(db, allExternalIds);

  for (const email of rawEmails) {
    if (!isBankSender(email.from, senders)) {
      result.filtered++;
      continue;
    }

    if (processedIds.has(email.externalId)) {
      result.skippedDuplicate++;
      continue;
    }

    let parsed: LlmParsedTransaction | null = null;
    let parseError = false;

    try {
      parsed = await parseEmail(db, userId, email);
    } catch {
      parseError = true;
    }

    if (!parsed) {
      result.failed++;
      await insertProcessedEmail(db, {
        id: generateId("pe"),
        externalId: email.externalId,
        provider: email.provider,
        status: "failed",
        failureReason: parseError ? "parse_error" : "parse_failed",
        subject: email.subject,
        rawBodyPreview: email.body.slice(0, 500),
        receivedAt: email.receivedAt,
        transactionId: null,
        confidence: null,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const validation = llmOutputSchema.safeParse(parsed);
    if (!validation.success) {
      result.failed++;
      await insertProcessedEmail(db, {
        id: generateId("pe"),
        externalId: email.externalId,
        provider: email.provider,
        status: "failed",
        failureReason: `validation: ${validation.error.issues[0]?.message ?? "invalid"}`,
        subject: email.subject,
        rawBodyPreview: email.body.slice(0, 500),
        receivedAt: email.receivedAt,
        transactionId: null,
        confidence: null,
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const validated = validation.data;

    if (validated.confidence < 0.7) {
      await saveTransaction(db, userId, validated, email, "needs_review");
      result.needsReview++;
      continue;
    }

    await saveTransaction(db, userId, validated, email, "success");

    // Cache merchant rule for future lookups
    const keyword = extractKeyword(email.subject);
    await insertMerchantRule(db, userId, email.from, keyword, validated.categoryId);

    result.saved++;
  }

  return result;
}
