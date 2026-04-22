import type { AnyDb } from "@/shared/db";
import type {
  CopAmount,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  UserId,
} from "@/shared/types/branded";
import type { FinancialAccountKind } from "../../schema";
import type { FinancialAccountIdentifierRow } from "../identifiers-repository";
import type { OpeningBalanceRow } from "../opening-balances-repository";
import type { FinancialAccountRow } from "../repository";

export const MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE = "manual:account_hint";

export type CreateFinancialAccountManagementServiceDeps = {
  readonly now?: () => IsoDateTime;
  readonly createAccountId?: () => FinancialAccountId;
  readonly createOpeningBalanceId?: () => OpeningBalanceId;
  readonly createIdentifierId?: () => FinancialAccountIdentifierId;
};

export type CreateAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly name: string;
  readonly kind: FinancialAccountKind;
  readonly openingBalanceAmount: CopAmount | null;
  readonly openingBalanceEffectiveDate: IsoDate | null;
  readonly manualIdentifierValue: string | null;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

export type UpdateAccountInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly name: string;
  readonly kind: FinancialAccountKind;
  readonly openingBalanceAmount: CopAmount | null;
  readonly openingBalanceEffectiveDate: IsoDate | null;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

export type AddManualIdentifierInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly value: string;
};

export type GetAccountDetailsInput = {
  readonly db: AnyDb;
  readonly accountId: FinancialAccountId;
};

export type CreateAccountResult = {
  readonly account: FinancialAccountRow;
};

export type FinancialAccountDetails = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
  readonly identifiers: readonly FinancialAccountIdentifierRow[];
  readonly hasBillingProfileGap: boolean;
};

export type FinancialAccountManagementDeps = {
  readonly now: () => IsoDateTime;
  readonly createAccountId: () => FinancialAccountId;
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly createIdentifierId: () => FinancialAccountIdentifierId;
};

export type OpeningBalanceInput = {
  readonly amount: CopAmount | null;
  readonly effectiveDate: IsoDate | null;
};

export type BillingProfile = Pick<FinancialAccountRow, "statementClosingDay" | "paymentDueDay">;

export type OpeningBalanceDraft = Pick<OpeningBalanceRow, "amount" | "effectiveDate">;

export type BillingProfileInput = {
  readonly kind: FinancialAccountKind;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

export type AccountShapeInput = Pick<
  CreateAccountInput,
  | "name"
  | "kind"
  | "openingBalanceAmount"
  | "openingBalanceEffectiveDate"
  | "statementClosingDay"
  | "paymentDueDay"
>;

export type NormalizedAccountShape = {
  readonly name: string;
  readonly kind: FinancialAccountKind;
  readonly billingProfile: BillingProfile;
  readonly openingBalance: OpeningBalanceDraft | null;
};

export type CreateAccountPlan = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
  readonly manualIdentifier: FinancialAccountIdentifierRow | null;
};

export type UpdateAccountPlan = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
};

export type BuildNewAccountRowInput = {
  readonly accountId: FinancialAccountId;
  readonly userId: UserId;
  readonly shape: NormalizedAccountShape;
  readonly createdAt: IsoDateTime;
};

export type BuildCreateOpeningBalanceInput = {
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly openingBalance: OpeningBalanceDraft | null;
  readonly createdAt: IsoDateTime;
};

export type BuildManualIdentifierRowInput = {
  readonly createIdentifierId: () => FinancialAccountIdentifierId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly value: string | null;
  readonly updatedAt: IsoDateTime;
};

export type PlanAccountCreationInput = {
  readonly deps: FinancialAccountManagementDeps;
  readonly input: CreateAccountInput;
  readonly createdAt: IsoDateTime;
};

export type BuildUpdatedAccountRowInput = {
  readonly existingAccount: FinancialAccountRow;
  readonly shape: NormalizedAccountShape;
  readonly updatedAt: IsoDateTime;
};

export type BuildActiveOpeningBalanceInput = {
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly openingBalance: OpeningBalanceDraft;
  readonly existingOpeningBalance: OpeningBalanceRow | null;
  readonly updatedAt: IsoDateTime;
};

export type BuildUpdatedOpeningBalanceInput = {
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly openingBalance: OpeningBalanceDraft | null;
  readonly existingOpeningBalance: OpeningBalanceRow | null;
  readonly updatedAt: IsoDateTime;
};

export type PlanAccountUpdateInput = {
  readonly deps: FinancialAccountManagementDeps;
  readonly input: UpdateAccountInput;
  readonly updatedAt: IsoDateTime;
  readonly existingAccount: FinancialAccountRow;
  readonly existingOpeningBalance: OpeningBalanceRow | null;
};
