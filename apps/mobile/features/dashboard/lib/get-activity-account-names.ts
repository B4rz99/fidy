import { getFinancialAccountsForUser } from "@/features/financial-accounts/public";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

export function getActivityAccountNames(db: AnyDb | null, userId: UserId | null) {
  if (!db || !userId) {
    return {};
  }

  return Object.fromEntries(
    getFinancialAccountsForUser(db, userId).map((account) => [account.id, account.name])
  );
}
