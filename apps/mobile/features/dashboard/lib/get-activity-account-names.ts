import { getFinancialAccountsForUser } from "@/features/financial-accounts/public";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

function isMissingSqliteTableError(error: unknown) {
  return error instanceof Error && /no such table: financial_accounts/i.test(error.message);
}

export function getActivityAccountNames(db: AnyDb | null, userId: UserId | null) {
  if (!db || !userId) {
    return {};
  }

  try {
    return Object.fromEntries(
      getFinancialAccountsForUser(db, userId).map((account) => [account.id, account.name])
    );
  } catch (error) {
    if (isMissingSqliteTableError(error)) {
      return {};
    }
    throw error;
  }
}
