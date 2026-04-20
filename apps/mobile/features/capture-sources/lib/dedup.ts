import { and, eq } from "drizzle-orm";
import { getActiveTransactionConditions } from "@/features/transactions/lib/active-transaction-conditions";
import type { AnyDb } from "@/shared/db/client";
import { processedCaptures, transactions } from "@/shared/db/schema";
import { merchantsMatch, normalizeMerchant } from "@/shared/lib/normalize-merchant";
import { assertCopAmount, assertIsoDate, assertUserId } from "@/shared/types/assertions";
import type { TransactionId } from "@/shared/types/branded";

/**
 * Creates a fingerprint hash for deduplication across capture sources.
 * Same amount + date + normalized merchant → same fingerprint.
 */
export function captureFingerprint(
  source: string,
  amount: number,
  date: string,
  merchant: string
): string {
  return `${source}:${amount}:${date}:${normalizeMerchant(merchant)}`;
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
  db: AnyDb,
  userId: string,
  amount: number,
  date: string,
  merchant: string
): Promise<TransactionId | null> {
  assertUserId(userId);
  assertCopAmount(amount);
  assertIsoDate(date);
  const normalized = normalizeMerchant(merchant);
  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        ...getActiveTransactionConditions(userId),
        eq(transactions.amount, amount),
        eq(transactions.date, date)
      )
    );

  const match = rows.find((row) => {
    const desc = normalizeMerchant(row.description ?? "");
    return merchantsMatch(desc, normalized);
  });

  return match?.id ?? null;
}
