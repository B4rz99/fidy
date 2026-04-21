import { and, eq } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/lib/active-transaction-conditions";
import type { AnyDb } from "@/shared/db/client";
import { processedCaptures, transactions } from "@/shared/db/schema";
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
export async function isCaptureProcessed(db: AnyDb, fingerprintHash: string): Promise<boolean> {
  const rows = await db
    .select({ id: processedCaptures.id })
    .from(processedCaptures)
    .where(eq(processedCaptures.fingerprintHash, fingerprintHash));
  return rows.length > 0;
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
  const rows = await input.db
    .select({
      id: transactions.id,
      description: transactions.description,
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
    const desc = normalizeMerchant(row.description ?? "");
    return merchantsMatch(desc, normalized);
  });

  return match?.id ?? null;
}
