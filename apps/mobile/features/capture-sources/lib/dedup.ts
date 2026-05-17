import { and, eq, isNull } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/query.public";
import type { AnyDb } from "@/shared/db/client";
import { processedSourceEvents, transactions } from "@/shared/db/schema";
import { merchantsMatch, normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { assertCopAmount, assertIsoDate, assertUserId } from "@/shared/types/assertions";
import type { TransactionId } from "@/shared/types/branded";

type CaptureFingerprintInput = {
  readonly source: string;
  readonly amount: number;
  readonly date: string;
  readonly merchant: string;
};
type DuplicateTransactionLookupInput = {
  readonly db: AnyDb;
  readonly userId: string;
  readonly amount: number;
  readonly date: string;
  readonly merchant: string;
};
type CaptureProcessedLookupInput = {
  readonly db: AnyDb;
  readonly userId: string;
  readonly sourceFamily: string;
  readonly sourceId: string;
  readonly sourceEventId: string;
};

/**
 * Creates a fingerprint hash for deduplication across capture sources.
 * Same amount + date + normalized merchant → same fingerprint.
 */
export function captureFingerprint(input: CaptureFingerprintInput): string {
  return `${input.source}:${input.amount}:${input.date}:${normalizeMerchant(input.merchant)}`;
}

/**
 * Checks whether a capture with this fingerprint has already been processed.
 */
export async function isCaptureProcessed(input: CaptureProcessedLookupInput): Promise<boolean> {
  assertUserId(input.userId);
  const sourceEventRows = await input.db
    .select({ id: processedSourceEvents.id, status: processedSourceEvents.status })
    .from(processedSourceEvents)
    .where(
      and(
        eq(processedSourceEvents.userId, input.userId),
        eq(processedSourceEvents.sourceFamily, input.sourceFamily),
        eq(processedSourceEvents.sourceId, input.sourceId),
        eq(processedSourceEvents.sourceEventId, input.sourceEventId),
        isNull(processedSourceEvents.deletedAt)
      )
    );
  if (sourceEventRows.some((row) => row.status !== "failed")) return true;

  return false;
}

/**
 * Checks if a transaction with the same amount + date already exists
 * across ALL sources (email, notification, apple pay, manual).
 * Returns the existing transaction ID if found, null otherwise.
 */
export async function findDuplicateTransaction(
  input: DuplicateTransactionLookupInput
): Promise<TransactionId | null> {
  assertUserId(input.userId);
  assertCopAmount(input.amount);
  assertIsoDate(input.date);
  const normalized = normalizeMerchant(input.merchant);
  if (normalized.length === 0) return null;

  const rows = await input.db
    .select({
      id: transactions.id,
      description: transactions.description,
      counterpartyName: transactions.counterpartyName,
    })
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(input.userId),
        eq(transactions.amount, input.amount),
        eq(transactions.date, input.date)
      )
    );

  const match = rows.find((row) => {
    const desc = normalizeMerchant(row.counterpartyName ?? "");
    return desc.length > 0 && merchantsMatch(desc, normalized);
  });

  return match?.id ?? null;
}
