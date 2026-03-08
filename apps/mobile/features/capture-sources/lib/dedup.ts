import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { processedCaptures, transactions } from "@/shared/db/schema";
import { normalizeMerchant } from "@/shared/lib/normalize-merchant";

/**
 * Creates a fingerprint hash for deduplication across capture sources.
 * Same amount + date + normalized merchant → same fingerprint.
 */
export function captureFingerprint(
  source: string,
  amountCents: number,
  date: string,
  merchant: string
): string {
  return `${source}:${amountCents}:${date}:${normalizeMerchant(merchant)}`;
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
  amountCents: number,
  date: string,
  merchant: string
): Promise<string | null> {
  const normalized = normalizeMerchant(merchant);
  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.amountCents, amountCents),
        eq(transactions.date, date),
        isNull(transactions.deletedAt)
      )
    );

  const match = rows.find((row) => {
    const desc = normalizeMerchant(row.description ?? "");
    return desc === normalized;
  });

  return match?.id ?? null;
}
