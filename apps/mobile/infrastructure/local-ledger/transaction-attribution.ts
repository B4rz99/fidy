import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { financialAccounts, transactions } from "@/shared/db/schema";
import type {
  FinancialAccountId,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type TransactionAccountAttributionState = "confirmed" | "inferred";

export function updateTransactionAccountAttribution(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly transactionId: TransactionId;
    readonly accountId: FinancialAccountId;
    readonly accountAttributionState: TransactionAccountAttributionState;
    readonly updatedAt: IsoDateTime;
  }
) {
  const accountRows = db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, input.accountId),
        eq(financialAccounts.userId, input.userId),
        isNull(financialAccounts.deletedAt)
      )
    )
    .all();
  if (accountRows.length !== 1) {
    throw new Error("Financial account attribution target was not found");
  }

  const result = db
    .update(transactions)
    .set({
      accountId: input.accountId,
      accountAttributionState: input.accountAttributionState,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.userId, input.userId),
        isNull(transactions.voidedAt),
        isNull(transactions.supersededAt)
      )
    )
    .run();
  if (result.changes !== 1) {
    throw new Error("Transaction account attribution target was not found");
  }
}
