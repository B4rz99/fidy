import type { FinancialAccountRow } from "@/features/financial-accounts/lib/repository";

type FinancialAccountListRow = Pick<
  FinancialAccountRow,
  | "id"
  | "userId"
  | "name"
  | "kind"
  | "isDefault"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "statementClosingDay"
  | "paymentDueDay"
>;

export type FinancialAccountListItem = {
  readonly account: FinancialAccountListRow;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};
