import type { FinancialAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

type FinancialAccountListRow = {
  readonly id: FinancialAccountId;
  readonly userId: UserId;
  readonly name: string;
  readonly kind: string;
  readonly isDefault: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly statementClosingDay?: number | null;
  readonly paymentDueDay?: number | null;
};

export type FinancialAccountListItem = {
  readonly account: FinancialAccountListRow;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};
