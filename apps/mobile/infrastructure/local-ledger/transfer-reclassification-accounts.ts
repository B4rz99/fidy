import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { financialAccounts } from "@/shared/db/schema";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

const countActiveAccountsForReclassification = (
  db: AnyDb,
  userId: UserId,
  accountIds: readonly [FinancialAccountId, FinancialAccountId]
): number =>
  db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.userId, userId),
        inArray(financialAccounts.id, accountIds),
        isNull(financialAccounts.deletedAt)
      )
    )
    .all().length;

export const canUseAccountsForReclassification = (
  db: AnyDb,
  userId: UserId,
  accountIds: readonly [FinancialAccountId, FinancialAccountId]
): boolean => countActiveAccountsForReclassification(db, userId, accountIds) === accountIds.length;
