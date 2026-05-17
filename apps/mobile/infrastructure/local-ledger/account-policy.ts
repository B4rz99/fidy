import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { financialAccounts } from "@/shared/db/schema";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

export function hasActiveFinancialAccount(
  db: AnyDb,
  userId: UserId,
  accountId: FinancialAccountId
): boolean {
  const rows = db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.userId, userId),
        isNull(financialAccounts.deletedAt)
      )
    )
    .limit(1)
    .all();

  return rows.length > 0;
}
