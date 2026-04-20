import type { AnyDb } from "@/shared/db";
import {
  generateFinancialAccountId,
  generateFinancialAccountIdentifierId,
  generateOpeningBalanceId,
  toIsoDateTime,
} from "@/shared/lib";
import type {
  CopAmount,
  FinancialAccountId,
  FinancialAccountIdentifierId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  UserId,
} from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";
import {
  type FinancialAccountIdentifierRow,
  getFinancialAccountIdentifiersForAccount,
  saveFinancialAccountIdentifierInTransaction,
} from "./identifiers-repository";
import {
  getOpeningBalanceForAccount,
  type OpeningBalanceRow,
  saveOpeningBalance,
} from "./opening-balances-repository";
import {
  type FinancialAccountRow,
  getFinancialAccountById,
  saveFinancialAccount,
} from "./repository";

export const MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE = "manual:account_hint";

type CreateFinancialAccountManagementServiceDeps = {
  readonly now?: () => IsoDateTime;
  readonly createAccountId?: () => FinancialAccountId;
  readonly createOpeningBalanceId?: () => OpeningBalanceId;
  readonly createIdentifierId?: () => FinancialAccountIdentifierId;
};

type CreateAccountInput = {
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

type UpdateAccountInput = {
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

type AddManualIdentifierInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly value: string;
};

type GetAccountDetailsInput = {
  readonly db: AnyDb;
  readonly accountId: FinancialAccountId;
};

type CreateAccountResult = {
  readonly account: FinancialAccountRow;
};

type FinancialAccountDetails = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
  readonly identifiers: readonly FinancialAccountIdentifierRow[];
  readonly hasBillingProfileGap: boolean;
};

type FinancialAccountManagementDeps = {
  readonly now: () => IsoDateTime;
  readonly createAccountId: () => FinancialAccountId;
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly createIdentifierId: () => FinancialAccountIdentifierId;
};

type OpeningBalanceInput = {
  readonly amount: CopAmount | null;
  readonly effectiveDate: IsoDate | null;
};

type BillingProfile = Pick<FinancialAccountRow, "statementClosingDay" | "paymentDueDay">;

type OpeningBalanceDraft = Pick<OpeningBalanceRow, "amount" | "effectiveDate">;

type BillingProfileInput = {
  readonly kind: FinancialAccountKind;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

type AccountShapeInput = Pick<
  CreateAccountInput,
  | "name"
  | "kind"
  | "openingBalanceAmount"
  | "openingBalanceEffectiveDate"
  | "statementClosingDay"
  | "paymentDueDay"
>;

type NormalizedAccountShape = {
  readonly name: string;
  readonly kind: FinancialAccountKind;
  readonly billingProfile: BillingProfile;
  readonly openingBalance: OpeningBalanceDraft | null;
};

type CreateAccountPlan = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
  readonly manualIdentifier: FinancialAccountIdentifierRow | null;
};

type UpdateAccountPlan = {
  readonly account: FinancialAccountRow;
  readonly openingBalance: OpeningBalanceRow | null;
};

type BuildNewAccountRowInput = {
  readonly accountId: FinancialAccountId;
  readonly userId: UserId;
  readonly shape: NormalizedAccountShape;
  readonly createdAt: IsoDateTime;
};

type BuildCreateOpeningBalanceInput = {
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly openingBalance: OpeningBalanceDraft | null;
  readonly createdAt: IsoDateTime;
};

type BuildManualIdentifierRowInput = {
  readonly createIdentifierId: () => FinancialAccountIdentifierId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly value: string | null;
  readonly updatedAt: IsoDateTime;
};

type PlanAccountCreationInput = {
  readonly deps: FinancialAccountManagementDeps;
  readonly input: CreateAccountInput;
  readonly createdAt: IsoDateTime;
};

type BuildUpdatedAccountRowInput = {
  readonly existingAccount: FinancialAccountRow;
  readonly shape: NormalizedAccountShape;
  readonly updatedAt: IsoDateTime;
};

type BuildActiveOpeningBalanceInput = {
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly openingBalance: OpeningBalanceDraft;
  readonly existingOpeningBalance: OpeningBalanceRow | null;
  readonly updatedAt: IsoDateTime;
};

type BuildUpdatedOpeningBalanceInput = {
  readonly createOpeningBalanceId: () => OpeningBalanceId;
  readonly userId: UserId;
  readonly accountId: FinancialAccountId;
  readonly openingBalance: OpeningBalanceDraft | null;
  readonly existingOpeningBalance: OpeningBalanceRow | null;
  readonly updatedAt: IsoDateTime;
};

type PlanAccountUpdateInput = {
  readonly deps: FinancialAccountManagementDeps;
  readonly input: UpdateAccountInput;
  readonly updatedAt: IsoDateTime;
  readonly existingAccount: FinancialAccountRow;
  readonly existingOpeningBalance: OpeningBalanceRow | null;
};

function trimOrNull(value: string | null) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function requireFinancialAccountName(name: string) {
  const normalizedName = name.trim();

  if (normalizedName.length === 0) {
    throw new Error("financial account name is required");
  }

  return normalizedName;
}

function hasBillingProfileGap(
  account: Pick<FinancialAccountRow, "kind" | "statementClosingDay" | "paymentDueDay">
) {
  return (
    account.kind === "credit_card" &&
    (account.statementClosingDay == null || account.paymentDueDay == null)
  );
}

function hasPartialOpeningBalance(input: OpeningBalanceInput) {
  return input.amount != null || input.effectiveDate != null;
}

function hasMissingOpeningBalanceValue(input: OpeningBalanceInput) {
  return input.amount == null || input.effectiveDate == null;
}

function normalizeBillingDay(value: number | null, label: string) {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error(`${label} must be an integer between 1 and 31`);
  }

  return value;
}

function normalizeBillingProfile(input: BillingProfileInput): BillingProfile {
  if (input.kind !== "credit_card") {
    const emptyBillingProfile: BillingProfile = {
      statementClosingDay: null,
      paymentDueDay: null,
    };

    return emptyBillingProfile;
  }

  const billingProfile: BillingProfile = {
    statementClosingDay: normalizeBillingDay(input.statementClosingDay, "statementClosingDay"),
    paymentDueDay: normalizeBillingDay(input.paymentDueDay, "paymentDueDay"),
  };

  return billingProfile;
}

function assertOwnedFinancialAccount(account: FinancialAccountRow | null, userId: UserId) {
  if (!account || account.deletedAt != null || account.userId !== userId) {
    throw new Error("financial account not found");
  }

  return account;
}

function normalizeAccountShape(input: AccountShapeInput): NormalizedAccountShape {
  const billingProfileInput: BillingProfileInput = {
    kind: input.kind,
    statementClosingDay: input.statementClosingDay,
    paymentDueDay: input.paymentDueDay,
  };
  const openingBalanceInput: OpeningBalanceInput = {
    amount: input.openingBalanceAmount,
    effectiveDate: input.openingBalanceEffectiveDate,
  };

  return {
    name: requireFinancialAccountName(input.name),
    kind: input.kind,
    billingProfile: normalizeBillingProfile(billingProfileInput),
    openingBalance: normalizeOpeningBalance(openingBalanceInput),
  };
}

function normalizeOpeningBalance(input: OpeningBalanceInput): OpeningBalanceDraft | null {
  if (!hasPartialOpeningBalance(input)) {
    return null;
  }

  if (hasMissingOpeningBalanceValue(input)) {
    throw new Error("opening balance requires both amount and effective date");
  }

  const openingBalance: OpeningBalanceDraft = {
    amount: input.amount as CopAmount,
    effectiveDate: input.effectiveDate as IsoDate,
  };

  return openingBalance;
}

function buildNewAccountRow(input: BuildNewAccountRowInput): FinancialAccountRow {
  return {
    id: input.accountId,
    userId: input.userId,
    name: input.shape.name,
    kind: input.shape.kind,
    isDefault: false,
    statementClosingDay: input.shape.billingProfile.statementClosingDay,
    paymentDueDay: input.shape.billingProfile.paymentDueDay,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
  };
}

function buildCreateOpeningBalanceRow(
  input: BuildCreateOpeningBalanceInput
): OpeningBalanceRow | null {
  if (input.openingBalance == null) {
    return null;
  }

  return {
    id: input.createOpeningBalanceId(),
    userId: input.userId,
    accountId: input.accountId,
    amount: input.openingBalance.amount,
    effectiveDate: input.openingBalance.effectiveDate,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    deletedAt: null,
  };
}

function buildManualIdentifierRow(
  input: BuildManualIdentifierRowInput
): FinancialAccountIdentifierRow | null {
  const normalizedIdentifierValue = trimOrNull(input.value);

  if (normalizedIdentifierValue == null) {
    return null;
  }

  return {
    id: input.createIdentifierId(),
    userId: input.userId,
    accountId: input.accountId,
    scope: MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
    value: normalizedIdentifierValue,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    deletedAt: null,
  };
}

function planAccountCreation(input: PlanAccountCreationInput): CreateAccountPlan {
  const shape = normalizeAccountShape(input.input);
  const accountId = input.deps.createAccountId();

  return {
    account: buildNewAccountRow({
      accountId,
      userId: input.input.userId,
      shape,
      createdAt: input.createdAt,
    }),
    openingBalance: buildCreateOpeningBalanceRow({
      createOpeningBalanceId: input.deps.createOpeningBalanceId,
      userId: input.input.userId,
      accountId,
      openingBalance: shape.openingBalance,
      createdAt: input.createdAt,
    }),
    manualIdentifier: buildManualIdentifierRow({
      createIdentifierId: input.deps.createIdentifierId,
      userId: input.input.userId,
      accountId,
      value: input.input.manualIdentifierValue,
      updatedAt: input.createdAt,
    }),
  };
}

function buildUpdatedAccountRow(input: BuildUpdatedAccountRowInput): FinancialAccountRow {
  return {
    ...input.existingAccount,
    name: input.shape.name,
    kind: input.shape.kind,
    statementClosingDay: input.shape.billingProfile.statementClosingDay,
    paymentDueDay: input.shape.billingProfile.paymentDueDay,
    updatedAt: input.updatedAt,
    deletedAt: null,
  };
}

function buildDeletedOpeningBalance(
  existingOpeningBalance: OpeningBalanceRow | null,
  updatedAt: IsoDateTime
): OpeningBalanceRow | null {
  if (existingOpeningBalance == null) {
    return null;
  }

  return {
    ...existingOpeningBalance,
    updatedAt,
    deletedAt: updatedAt,
  };
}

function buildActiveOpeningBalanceRow(input: BuildActiveOpeningBalanceInput): OpeningBalanceRow {
  return {
    id: input.existingOpeningBalance?.id ?? input.createOpeningBalanceId(),
    userId: input.userId,
    accountId: input.accountId,
    amount: input.openingBalance.amount,
    effectiveDate: input.openingBalance.effectiveDate,
    createdAt: input.existingOpeningBalance?.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    deletedAt: null,
  };
}

function buildUpdatedOpeningBalance(
  input: BuildUpdatedOpeningBalanceInput
): OpeningBalanceRow | null {
  if (input.openingBalance == null) {
    return buildDeletedOpeningBalance(input.existingOpeningBalance, input.updatedAt);
  }

  const activeOpeningBalance: BuildActiveOpeningBalanceInput = {
    createOpeningBalanceId: input.createOpeningBalanceId,
    userId: input.userId,
    accountId: input.accountId,
    openingBalance: input.openingBalance,
    existingOpeningBalance: input.existingOpeningBalance,
    updatedAt: input.updatedAt,
  };

  return buildActiveOpeningBalanceRow(activeOpeningBalance);
}

function planAccountUpdate(input: PlanAccountUpdateInput): UpdateAccountPlan {
  const shape = normalizeAccountShape(input.input);
  const account = buildUpdatedAccountRow({
    existingAccount: input.existingAccount,
    shape,
    updatedAt: input.updatedAt,
  });
  const openingBalanceInput: BuildUpdatedOpeningBalanceInput = {
    createOpeningBalanceId: input.deps.createOpeningBalanceId,
    userId: input.input.userId,
    accountId: input.input.accountId,
    openingBalance: shape.openingBalance,
    existingOpeningBalance: input.existingOpeningBalance,
    updatedAt: input.updatedAt,
  };

  return {
    account,
    openingBalance: buildUpdatedOpeningBalance(openingBalanceInput),
  };
}

function saveOptionalOpeningBalance(db: AnyDb, openingBalance: OpeningBalanceRow | null) {
  if (openingBalance == null) {
    return;
  }

  saveOpeningBalance(db, openingBalance);
}

function saveOptionalIdentifier(db: AnyDb, identifier: FinancialAccountIdentifierRow | null) {
  if (identifier == null) {
    return;
  }

  saveFinancialAccountIdentifierInTransaction(db, identifier);
}

function persistAccountCreation(input: { readonly db: AnyDb; readonly plan: CreateAccountPlan }) {
  input.db.transaction((tx) => {
    saveFinancialAccount(tx, input.plan.account);
    saveOptionalOpeningBalance(tx, input.plan.openingBalance);
    saveOptionalIdentifier(tx, input.plan.manualIdentifier);
  });
}

function persistAccountUpdate(input: { readonly db: AnyDb; readonly plan: UpdateAccountPlan }) {
  input.db.transaction((tx) => {
    saveFinancialAccount(tx, input.plan.account);
    saveOptionalOpeningBalance(tx, input.plan.openingBalance);
  });
}

function persistManualIdentifier(input: {
  readonly db: AnyDb;
  readonly identifier: FinancialAccountIdentifierRow | null;
}) {
  input.db.transaction((tx) => {
    saveOptionalIdentifier(tx, input.identifier);
  });
}

function getAccountDetails(input: GetAccountDetailsInput): FinancialAccountDetails | null {
  const account = getFinancialAccountById(input.db, input.accountId);

  if (!account || account.deletedAt != null) {
    return null;
  }

  return {
    account,
    openingBalance: getOpeningBalanceForAccount(input.db, input.accountId),
    identifiers: getFinancialAccountIdentifiersForAccount(input.db, input.accountId),
    hasBillingProfileGap: hasBillingProfileGap(account),
  };
}

function createAccount(
  deps: FinancialAccountManagementDeps,
  input: CreateAccountInput
): CreateAccountResult {
  const plan = planAccountCreation({
    deps,
    input,
    createdAt: deps.now(),
  });

  persistAccountCreation({
    db: input.db,
    plan,
  });

  return { account: plan.account };
}

function updateAccount(
  deps: FinancialAccountManagementDeps,
  input: UpdateAccountInput
): CreateAccountResult {
  const existingAccount = assertOwnedFinancialAccount(
    getFinancialAccountById(input.db, input.accountId),
    input.userId
  );
  const plan = planAccountUpdate({
    deps,
    input,
    updatedAt: deps.now(),
    existingAccount,
    existingOpeningBalance: getOpeningBalanceForAccount(input.db, input.accountId),
  });

  persistAccountUpdate({
    db: input.db,
    plan,
  });

  return { account: plan.account };
}

function addManualIdentifier(
  deps: FinancialAccountManagementDeps,
  input: AddManualIdentifierInput
) {
  const account = assertOwnedFinancialAccount(
    getFinancialAccountById(input.db, input.accountId),
    input.userId
  );

  persistManualIdentifier({
    db: input.db,
    identifier: buildManualIdentifierRow({
      createIdentifierId: deps.createIdentifierId,
      userId: input.userId,
      accountId: account.id,
      value: input.value,
      updatedAt: deps.now(),
    }),
  });
}

function resolveManagementDeps(
  deps: CreateFinancialAccountManagementServiceDeps
): FinancialAccountManagementDeps {
  return {
    now: deps.now ?? (() => toIsoDateTime(new Date())),
    createAccountId: deps.createAccountId ?? generateFinancialAccountId,
    createOpeningBalanceId: deps.createOpeningBalanceId ?? generateOpeningBalanceId,
    createIdentifierId: deps.createIdentifierId ?? generateFinancialAccountIdentifierId,
  };
}

export function createFinancialAccountManagementService(
  deps: CreateFinancialAccountManagementServiceDeps = {}
) {
  const resolvedDeps = resolveManagementDeps(deps);

  return {
    getAccountDetails,
    createAccount: (input: CreateAccountInput) => createAccount(resolvedDeps, input),
    updateAccount: (input: UpdateAccountInput) => updateAccount(resolvedDeps, input),
    addManualIdentifier: (input: AddManualIdentifierInput) =>
      addManualIdentifier(resolvedDeps, input),
  };
}
