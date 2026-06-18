import { z } from "zod";
import { financialAccountKinds } from "./lib/kind-options";

export const financialAccountKindSchema = z.enum(financialAccountKinds);

export type FinancialAccountKind = z.infer<typeof financialAccountKindSchema>;
