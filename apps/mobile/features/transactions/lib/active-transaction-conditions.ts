import { eq, isNull } from "drizzle-orm";
import { transactions } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

type TransactionActivityState = {
  readonly deletedAt?: string | null;
  readonly supersededAt?: string | null;
};

export function getActiveTransactionConditions(userId: UserId) {
  return [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    isNull(transactions.supersededAt),
  ] as const;
}

export function isActiveTransactionRow(row: TransactionActivityState | null | undefined): boolean {
  return row != null && row.deletedAt == null && row.supersededAt == null;
}
