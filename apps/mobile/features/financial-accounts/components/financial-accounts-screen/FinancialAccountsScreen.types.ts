import type { FinancialAccountRow } from "@/features/financial-accounts/lib/repository";

export type FinancialAccountListItem = {
  readonly account: FinancialAccountRow;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};
