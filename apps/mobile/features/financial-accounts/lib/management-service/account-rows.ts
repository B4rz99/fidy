import type { FinancialAccountRow } from "../repository";
import type { BuildNewAccountRowInput, BuildUpdatedAccountRowInput } from "./types";

export function buildNewAccountRow(input: BuildNewAccountRowInput): FinancialAccountRow {
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

export function buildUpdatedAccountRow(input: BuildUpdatedAccountRowInput): FinancialAccountRow {
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
