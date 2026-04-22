import type { FinancialAccountIdentifierRow } from "../identifiers-repository";
import { trimOrNull } from "./shape";
import type { BuildManualIdentifierRowInput } from "./types";
import { MANUAL_FINANCIAL_ACCOUNT_IDENTIFIER_SCOPE } from "./types";

export function buildManualIdentifierRow(
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
