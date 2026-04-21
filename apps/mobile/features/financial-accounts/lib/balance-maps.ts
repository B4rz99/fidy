import type { CopAmount, FinancialAccountId } from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";

type AccountBalanceMap = Record<string, CopAmount>;
type AccountRow = {
  readonly id: FinancialAccountId;
  readonly kind: FinancialAccountKind;
};
type BalanceAggregateRow = {
  readonly accountId: FinancialAccountId;
  readonly total: CopAmount;
};
type OpeningBalanceAggregateRow = {
  readonly accountId: FinancialAccountId;
  readonly amount: CopAmount;
};
type BuildAccountBalanceMapInput = {
  readonly accounts: readonly AccountRow[];
  readonly openingBalanceTotals: AccountBalanceMap;
  readonly transactionTotals: AccountBalanceMap;
  readonly transferTotals: AccountBalanceMap;
};

export function getAccountKindMap(
  accounts: readonly AccountRow[]
): Record<string, FinancialAccountKind> {
  return Object.fromEntries(accounts.map((account) => [account.id, account.kind])) as Record<
    string,
    FinancialAccountKind
  >;
}

export function getOpeningBalanceTotals(
  rows: readonly OpeningBalanceAggregateRow[],
  accountKinds: Record<string, FinancialAccountKind>
): AccountBalanceMap {
  const totals: AccountBalanceMap = {};

  rows.forEach((row) => {
    totals[row.accountId] = getOpeningBalanceEffect(
      accountKinds[row.accountId] ?? "checking",
      row.amount
    );
  });

  return totals;
}

export function combineTransferBalanceEffects(
  outgoingRows: readonly BalanceAggregateRow[],
  incomingRows: readonly BalanceAggregateRow[]
): AccountBalanceMap {
  const totals: AccountBalanceMap = {};

  [...outgoingRows, ...incomingRows].forEach((row) => {
    totals[row.accountId] = (getAccountBalanceTotal(totals, row.accountId) +
      row.total) as CopAmount;
  });

  return totals;
}

export function buildAccountBalanceMap(
  input: BuildAccountBalanceMapInput
): Record<string, CopAmount> {
  const totals: AccountBalanceMap = {};

  input.accounts.forEach((account) => {
    totals[account.id] = sumAccountBalanceTotals([
      input.openingBalanceTotals[account.id],
      input.transactionTotals[account.id],
      input.transferTotals[account.id],
    ]);
  });

  return totals;
}

function getOpeningBalanceEffect(kind: FinancialAccountKind, amount: CopAmount): CopAmount {
  return (kind === "credit_card" ? -amount : amount) as CopAmount;
}

function getAccountBalanceTotal(
  totals: AccountBalanceMap,
  accountId: FinancialAccountId
): CopAmount {
  return (totals[accountId] ?? 0) as CopAmount;
}

function sumAccountBalanceTotals(totals: readonly (CopAmount | undefined)[]): CopAmount {
  return totals
    .filter((total): total is CopAmount => total !== undefined)
    .reduce((sum, total) => (sum + total) as CopAmount, 0 as CopAmount);
}
