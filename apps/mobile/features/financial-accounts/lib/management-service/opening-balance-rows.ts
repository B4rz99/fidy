import type { OpeningBalanceRow } from "../opening-balances-repository";
import { buildDeletedOpeningBalance } from "./shape";
import type {
  BuildActiveOpeningBalanceInput,
  BuildCreateOpeningBalanceInput,
  BuildUpdatedOpeningBalanceInput,
} from "./types";

export function buildCreateOpeningBalanceRow(input: BuildCreateOpeningBalanceInput) {
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

export function buildUpdatedOpeningBalance(input: BuildUpdatedOpeningBalanceInput) {
  if (input.openingBalance == null) {
    return input.existingOpeningBalance == null
      ? null
      : buildDeletedOpeningBalance(input.existingOpeningBalance, input.updatedAt);
  }

  return buildActiveOpeningBalanceRow({
    createOpeningBalanceId: input.createOpeningBalanceId,
    userId: input.userId,
    accountId: input.accountId,
    openingBalance: input.openingBalance,
    existingOpeningBalance: input.existingOpeningBalance,
    updatedAt: input.updatedAt,
  });
}
