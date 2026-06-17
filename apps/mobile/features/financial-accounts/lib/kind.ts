import type { FinancialAccountKind } from "../schema";
import { financialAccountKinds } from "./kind-options";

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
