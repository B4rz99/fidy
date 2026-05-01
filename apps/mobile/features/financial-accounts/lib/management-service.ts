import {
  generateFinancialAccountId,
  generateFinancialAccountIdentifierId,
  generateOpeningBalanceId,
  toIsoDateTime,
} from "@/shared/lib";
import { planAccountCreation } from "./management-service/creation-plan";
import { buildManualIdentifierRow } from "./management-service/manual-identifier-row";
import {
  getAccountDetails,
  persistAccountCreation,
  persistAccountUpdate,
  persistManualIdentifier,
} from "./management-service/persistence";
import { assertOwnedFinancialAccount } from "./management-service/shape";
import {
  type AddManualIdentifierInput,
  type CreateAccountInput,
  type CreateAccountResult,
  type CreateFinancialAccountManagementServiceDeps,
  type FinancialAccountManagementDeps,
  MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE,
  type UpdateAccountInput,
} from "./management-service/types";
import { planAccountUpdate } from "./management-service/update-plan";
import { canFinancialAccountHaveIdentifiers, readFinancialAccountKind } from "./kind";
import { getOpeningBalanceForAccount } from "./opening-balances-repository";
import { getFinancialAccountById } from "./repository";

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

  if (!canFinancialAccountHaveIdentifiers(readFinancialAccountKind(account.kind))) {
    return;
  }

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

export { MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE };

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
