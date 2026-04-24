import type { FinancialAccountRow } from "@/features/financial-accounts/public";

export type FinancialAccountListItem = {
  readonly account: FinancialAccountRow;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};
