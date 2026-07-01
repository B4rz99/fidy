import type { IsoDateTime } from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";
import { buildDefaultFinancialAccountId as toDefaultFinancialAccountId } from "./default-account";
import type { FinancialAccountRow } from "./repository";

const DEFAULT_FINANCIAL_ACCOUNT_KIND: FinancialAccountKind = "cash";

export function findExistingDefaultFinancialAccount(rows: readonly FinancialAccountRow[]) {
  return rows.find((row) => row.isDefault) ?? null;
}

export function buildDefaultFinancialAccountRow(
  userId: FinancialAccountRow["userId"],
  now: IsoDateTime,
  name: string
): FinancialAccountRow {
  return {
    id: toDefaultFinancialAccountId(userId),
    userId,
    name,
    kind: DEFAULT_FINANCIAL_ACCOUNT_KIND,
    statementClosingDay: null,
    paymentDueDay: null,
    createdAt: now,
    isDefault: true,
    source: "local_ledger",
    updatedAt: now,
    deletedAt: null,
  };
}
