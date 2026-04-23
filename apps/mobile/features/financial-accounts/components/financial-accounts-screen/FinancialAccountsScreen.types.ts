import type { FinancialAccountRow } from "@/features/financial-accounts";

export type FinancialAccountListItem = {
  readonly account: FinancialAccountRow;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};
