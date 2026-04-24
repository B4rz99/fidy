import { getFinancialAccountsForUser } from "@/features/financial-accounts/public";
import type { AnyDb } from "@/shared/db";
import { isMissingSqliteTableError } from "@/shared/lib/sqlite-errors";
import type { UserId } from "@/shared/types/branded";

export function getActivityAccountNames(db: AnyDb | null, userId: UserId | null) {
  if (!db || !userId) {
    return {};
  }

  try {
    return Object.fromEntries(
      getFinancialAccountsForUser(db, userId).map((account) => [account.id, account.name])
    );
  } catch (error) {
    // Home can render before local SQLite migrations finish on a fresh/stale install.
    if (isMissingSqliteTableError(error)) {
      return {};
    }

    throw error;
  }
}
