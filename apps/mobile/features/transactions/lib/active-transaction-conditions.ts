import { eq, isNull } from "drizzle-orm";
import { transactions } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

type TransactionActivityState = {
  readonly voidedAt?: string | null;
  readonly supersededAt?: string | null;
};

export function getActiveTransactionConditions(userId: UserId) {
  return [
    eq(transactions.userId, userId),
    isNull(transactions.voidedAt),
    isNull(transactions.supersededAt),
  ] as const;
}

export function isActiveTransactionRow(row: TransactionActivityState | null | undefined): boolean {
  return row != null && row.voidedAt == null && row.supersededAt == null;
}
