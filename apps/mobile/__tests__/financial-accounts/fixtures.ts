import type {
  CopAmount,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  UserId,
} from "@/shared/types/branded";

type FinancialAccountFixture = {
  readonly id: FinancialAccountId;
  readonly userId: UserId;
  readonly name: string;
  readonly kind: "wallet" | "cash" | "checking" | "credit_card";
  readonly isDefault: boolean;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
  readonly statementClosingDay?: number | null;
  readonly paymentDueDay?: number | null;
};

type OpeningBalanceFixture = {
  readonly id: OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly amount: CopAmount;
  readonly effectiveDate: IsoDate;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};

type IdentifierFixture = {
  readonly id: FinancialAccountIdentifierId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly scope: string;
  readonly value: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};

type BalanceTransactionFixture = {
  readonly id: string;
  readonly accountId: string;
  readonly type: "expense" | "income";
  readonly amount: number;
  readonly date: string;
  readonly accountAttributionState?: "confirmed" | "unresolved";
  readonly supersededAt?: IsoDateTime | null;
};

type BalanceTransferFixture = {
  readonly id: string;
  readonly amount: number;
  readonly date: string;
  readonly fromAccountId: string | null;
  readonly toAccountId: string | null;
  readonly fromExternalLabel?: string | null;
  readonly toExternalLabel?: string | null;
};

export const FIXTURE_USER_ID = "user-1" as UserId;
export const FIXTURE_NOW = "2026-04-18T10:00:00.000Z" as IsoDateTime;
export const FIXTURE_ACCOUNT_ID = "fa-1" as FinancialAccountId;

export const createFinancialAccountFixture = (
  overrides: Partial<FinancialAccountFixture> = {}
): FinancialAccountFixture => ({
  id: "fa-1" as FinancialAccountId,
  userId: FIXTURE_USER_ID,
  name: "Main wallet",
  kind: "wallet",
  isDefault: true,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  deletedAt: null,
  statementClosingDay: null,
  paymentDueDay: null,
  ...overrides,
});

export const createOpeningBalanceFixture = (
  overrides: Partial<OpeningBalanceFixture> = {}
): OpeningBalanceFixture => ({
  id: "ob-1" as OpeningBalanceId,
  userId: FIXTURE_USER_ID,
  accountId: FIXTURE_ACCOUNT_ID,
  amount: 500000 as CopAmount,
  effectiveDate: "2026-04-01" as IsoDate,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  deletedAt: null,
  ...overrides,
});

export const createIdentifierFixture = (
  overrides: Partial<IdentifierFixture> = {}
): IdentifierFixture => ({
  id: "fai-1" as FinancialAccountIdentifierId,
  userId: FIXTURE_USER_ID,
  accountId: FIXTURE_ACCOUNT_ID,
  scope: "email:bancolombia:last4",
  value: "1234",
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  deletedAt: null,
  ...overrides,
});

export const createBalanceTransactionFixture = (
  overrides: Partial<BalanceTransactionFixture> = {}
): BalanceTransactionFixture => ({
  id: "tx-1",
  accountId: "fa-1",
  type: "expense",
  amount: 1000,
  date: "2026-04-10",
  accountAttributionState: "confirmed",
  supersededAt: null,
  ...overrides,
});

export const createBalanceTransferFixture = (
  overrides: Partial<BalanceTransferFixture> = {}
): BalanceTransferFixture => ({
  id: "tr-1",
  amount: 1000,
  date: "2026-04-10",
  fromAccountId: "fa-1",
  toAccountId: "fa-2",
  fromExternalLabel: null,
  toExternalLabel: null,
  ...overrides,
});
