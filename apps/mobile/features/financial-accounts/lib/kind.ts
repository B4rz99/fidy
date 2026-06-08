import { type FinancialAccountKind, financialAccountKindSchema } from "../schema";

export function readFinancialAccountKind(value: string): FinancialAccountKind {
  return financialAccountKindSchema.parse(value);
}

export function canFinancialAccountHaveIdentifiers(kind: FinancialAccountKind): boolean {
  return kind !== "cash";
}
