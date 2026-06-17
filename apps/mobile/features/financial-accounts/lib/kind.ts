import type { FinancialAccountKind } from "../schema";

const financialAccountKinds = ["checking", "savings", "wallet", "cash", "credit_card"] as const;

function isFinancialAccountKind(value: string): value is FinancialAccountKind {
  return financialAccountKinds.some((kind) => kind === value);
}

export function readFinancialAccountKind(value: string): FinancialAccountKind {
  if (isFinancialAccountKind(value)) {
    return value;
  }

  throw new Error(`Unsupported financial account kind: ${value}`);
}

export function canFinancialAccountHaveIdentifiers(kind: FinancialAccountKind): boolean {
  return kind !== "cash";
}
