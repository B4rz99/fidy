import { type FinancialAccountKind, financialAccountKindSchema } from "../schema";

export function readFinancialAccountKind(value: string): FinancialAccountKind {
  const parsedKind = financialAccountKindSchema.safeParse(value);
  return parsedKind.success ? parsedKind.data : "checking";
}
