import { buildNewAccountRow } from "./account-rows";
import { buildManualIdentifierRow } from "./manual-identifier-row";
import { buildCreateOpeningBalanceRow } from "./opening-balance-rows";
import { normalizeAccountShape } from "./shape";
import type { CreateAccountPlan, PlanAccountCreationInput } from "./types";
import { canFinancialAccountHaveIdentifiers } from "../kind";
import type { FinancialAccountKind } from "../../schema";

function getManualIdentifierValue(input: PlanAccountCreationInput, kind: FinancialAccountKind) {
  if (!canFinancialAccountHaveIdentifiers(kind)) {
    return null;
  }

  return input.input.manualIdentifierValue;
}

export function planAccountCreation(input: PlanAccountCreationInput): CreateAccountPlan {
  const shape = normalizeAccountShape(input.input);
  const accountId = input.deps.createAccountId();
  const account = buildNewAccountRow({
    accountId,
    userId: input.input.userId,
    shape,
    createdAt: input.createdAt,
  });
  const openingBalance = buildCreateOpeningBalanceRow({
    createOpeningBalanceId: input.deps.createOpeningBalanceId,
    userId: input.input.userId,
    accountId,
    openingBalance: shape.openingBalance,
    createdAt: input.createdAt,
  });
  const manualIdentifier = buildManualIdentifierRow({
    createIdentifierId: input.deps.createIdentifierId,
    userId: input.input.userId,
    accountId,
    value: getManualIdentifierValue(input, shape.kind),
    updatedAt: input.createdAt,
  });

  return {
    account,
    openingBalance,
    manualIdentifier,
  };
}
