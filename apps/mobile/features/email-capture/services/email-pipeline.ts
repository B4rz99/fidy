import { z } from "zod";
import { enqueueSync, insertTransaction } from "@/features/transactions/lib/repository";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import type { BankSender } from "../lib/bank-senders";
import { isBankSender } from "../lib/bank-senders";
import { getProcessedEmailByExternalId, insertProcessedEmail } from "../lib/repository";
import type { RawEmail } from "../schema";

export type ParsedTransaction = {
  type: "expense" | "income";
  amountCents: number;
  categoryId: string;
  description: string;
  date: string;
};

export type PipelineResult = {
  filtered: number;
  skippedDuplicate: number;
  saved: number;
  failed: number;
};

const parsedTransactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  amountCents: z.number().int().positive(),
  categoryId: z.string().min(1),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function processEmails(
  db: AnyDb,
  userId: string,
  rawEmails: RawEmail[],
  senders: readonly BankSender[],
  parseFn: (body: string) => Promise<ParsedTransaction | null>
): Promise<PipelineResult> {
  const result: PipelineResult = {
    filtered: 0,
    skippedDuplicate: 0,
    saved: 0,
    failed: 0,
  };

  for (const email of rawEmails) {
    if (!isBankSender(email.from, senders)) {
      result.filtered++;
      continue;
    }

    const existing = await getProcessedEmailByExternalId(db, email.externalId);
    if (existing) {
      result.skippedDuplicate++;
      continue;
    }

    let parsed: ParsedTransaction | null = null;
    let parseError = false;

    try {
      parsed = await parseFn(email.body);
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
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const validation = parsedTransactionSchema.safeParse(parsed);
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
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const validated = validation.data;
    const source = email.provider === "gmail" ? "email_gmail" : "email_outlook";
    const txId = generateId("tx");
    const now = new Date().toISOString();

    // TODO: Step 5 — deduplicate by amount + date + description (deferred)

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
      status: "success",
      failureReason: null,
      subject: email.subject,
      rawBodyPreview: email.body.slice(0, 500),
      receivedAt: email.receivedAt,
      transactionId: txId,
      createdAt: now,
    });

    result.saved++;
  }

  return result;
}
