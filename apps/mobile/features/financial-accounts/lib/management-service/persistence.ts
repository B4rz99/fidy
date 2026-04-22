import type { AnyDb } from "@/shared/db";
import type { FinancialAccountIdentifierRow } from "../identifiers-repository";
import {
  getFinancialAccountIdentifiersForAccount,
  saveFinancialAccountIdentifierInTransaction,
} from "../identifiers-repository";
import type { OpeningBalanceRow } from "../opening-balances-repository";
import { getOpeningBalanceForAccount, saveOpeningBalance } from "../opening-balances-repository";
import { getFinancialAccountById, saveFinancialAccount } from "../repository";
import { hasBillingProfileGap } from "./shape";
import type {
  CreateAccountPlan,
  FinancialAccountDetails,
  GetAccountDetailsInput,
  UpdateAccountPlan,
} from "./types";

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

export function persistAccountCreation(input: {
  readonly db: AnyDb;
  readonly plan: CreateAccountPlan;
}) {
  input.db.transaction((tx) => {
    saveFinancialAccount(tx, input.plan.account);
    saveOptionalOpeningBalance(tx, input.plan.openingBalance);
    saveOptionalIdentifier(tx, input.plan.manualIdentifier);
  });
}

export function persistAccountUpdate(input: {
  readonly db: AnyDb;
  readonly plan: UpdateAccountPlan;
}) {
  input.db.transaction((tx) => {
    saveFinancialAccount(tx, input.plan.account);
    saveOptionalOpeningBalance(tx, input.plan.openingBalance);
  });
}

export function persistManualIdentifier(input: {
  readonly db: AnyDb;
  readonly identifier: FinancialAccountIdentifierRow | null;
}) {
  input.db.transaction((tx) => {
    saveOptionalIdentifier(tx, input.identifier);
  });
}

export function getAccountDetails(input: GetAccountDetailsInput): FinancialAccountDetails | null {
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
