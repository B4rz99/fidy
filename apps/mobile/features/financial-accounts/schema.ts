import { z } from "zod";

export const financialAccountKindSchema = z.enum([
  "checking",
  "savings",
  "wallet",
  "cash",
  "credit_card",
]);

export type FinancialAccountKind = z.infer<typeof financialAccountKindSchema>;
