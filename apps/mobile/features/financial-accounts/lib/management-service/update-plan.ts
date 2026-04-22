import { buildUpdatedAccountRow } from "./account-rows";
import { buildUpdatedOpeningBalance } from "./opening-balance-rows";
import { normalizeAccountShape } from "./shape";
import type { PlanAccountUpdateInput, UpdateAccountPlan } from "./types";

export function planAccountUpdate(input: PlanAccountUpdateInput): UpdateAccountPlan {
  const shape = normalizeAccountShape(input.input);
  const account = buildUpdatedAccountRow({
    existingAccount: input.existingAccount,
    shape,
    updatedAt: input.updatedAt,
  });
  const openingBalance = buildUpdatedOpeningBalance({
    createOpeningBalanceId: input.deps.createOpeningBalanceId,
    userId: input.input.userId,
    accountId: input.input.accountId,
    openingBalance: shape.openingBalance,
    existingOpeningBalance: input.existingOpeningBalance,
    updatedAt: input.updatedAt,
  });

  return {
    account,
    openingBalance,
  };
}
