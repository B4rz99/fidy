import type { FinancialAccountRow } from "@/features/financial-accounts";
import type { FinancialAccountId } from "@/shared/types/branded";

export function hasSelectedFinancialAccount(
  accounts: readonly FinancialAccountRow[],
  accountId: FinancialAccountId | null
): boolean {
  return accountId != null && accounts.some((account) => account.id === accountId);
}
