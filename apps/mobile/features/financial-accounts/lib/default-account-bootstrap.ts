import type { IsoDateTime } from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";
import { buildDefaultFinancialAccountId as toDefaultFinancialAccountId } from "./default-account";
import type { FinancialAccountRow } from "./repository";

const DEFAULT_FINANCIAL_ACCOUNT_KIND: FinancialAccountKind = "cash";
type DefaultFinancialAccountFields = {
  readonly name: FinancialAccountRow["name"];
  readonly kind: FinancialAccountRow["kind"];
  readonly statementClosingDay: FinancialAccountRow["statementClosingDay"];
  readonly paymentDueDay: FinancialAccountRow["paymentDueDay"];
  readonly createdAt: FinancialAccountRow["createdAt"];
};

export function findCanonicalFinancialAccount(
  rows: readonly FinancialAccountRow[],
  userId: FinancialAccountRow["userId"]
) {
  const canonicalId = toDefaultFinancialAccountId(userId);
  return rows.find((row) => row.id === canonicalId) ?? null;
}

export function findExistingDefaultFinancialAccount(rows: readonly FinancialAccountRow[]) {
  return rows.find((row) => row.isDefault) ?? null;
}

export function promoteFinancialAccountToDefault(
  row: FinancialAccountRow,
  now: IsoDateTime
): FinancialAccountRow {
  return {
    ...row,
    isDefault: true,
    updatedAt: now,
    deletedAt: null,
  };
}

export function buildDefaultFinancialAccountRow(
  userId: FinancialAccountRow["userId"],
  now: IsoDateTime,
  name: string,
  existingCanonical: FinancialAccountRow | null
): FinancialAccountRow {
  const defaultFields = getDefaultFinancialAccountFields({
    existingCanonical,
    name,
    now,
  });

  return {
    id: toDefaultFinancialAccountId(userId),
    userId,
    ...defaultFields,
    isDefault: true,
    updatedAt: now,
    deletedAt: null,
  };
}

type DefaultFinancialAccountFieldInput = {
  readonly existingCanonical: FinancialAccountRow | null;
  readonly name: string;
  readonly now: IsoDateTime;
};

function getDefaultFinancialAccountFields(
  input: DefaultFinancialAccountFieldInput
): DefaultFinancialAccountFields {
  if (!input.existingCanonical) {
    return {
      name: input.name,
      kind: DEFAULT_FINANCIAL_ACCOUNT_KIND,
      statementClosingDay: null,
      paymentDueDay: null,
      createdAt: input.now,
    };
  }

  return {
    name: input.existingCanonical.name,
    kind: input.existingCanonical.kind,
    statementClosingDay: input.existingCanonical.statementClosingDay,
    paymentDueDay: input.existingCanonical.paymentDueDay,
    createdAt: input.existingCanonical.createdAt,
  };
}
