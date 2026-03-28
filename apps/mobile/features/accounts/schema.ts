import { z } from "zod";
import type { AccountId, CopAmount, UserId } from "@/shared/types/branded";

export const accountTypeSchema = z.enum(["debit", "credit", "wallet"]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const bankKeySchema = z.enum([
  // Major banks
  "bancolombia",
  "davivienda",
  "banco_bogota",
  "banco_popular",
  "banco_occidente",
  "av_villas",
  "bbva",
  "colpatria",
  "banco_caja_social",
  "gnb_sudameris",
  "citibank",
  "banco_falabella",
  "banco_pichincha",
  "bancoomeva",
  "banco_finandina",
  "davibank",
  "itau",
  "mibanco",
  "lulo_bank",
  "nubank",
  // Digital wallets
  "nequi",
  "daviplata",
  "dale",
  "rappicard",
  "rappipay",
  "tpaga",
  "google_wallet",
  // Catch-all
  "other",
]);
export type BankKey = z.infer<typeof bankKeySchema>;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: accountTypeSchema,
  bankKey: bankKeySchema,
  identifiers: z.array(z.string().trim().min(1)).default([]),
  initialBalance: z.number().int(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export type StoredAccount = {
  readonly id: AccountId;
  readonly userId: UserId;
  readonly name: string;
  readonly type: AccountType;
  readonly bankKey: BankKey;
  readonly identifiers: readonly string[];
  readonly initialBalance: CopAmount;
  readonly isDefault: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};
