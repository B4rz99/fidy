import { z } from "zod";
import type { AccountId, CopAmount, UserId } from "@/shared/types/branded";

export const accountTypeSchema = z.enum(["debit", "credit", "wallet"]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const bankKeySchema = z.enum([
  "bancolombia",
  "davibank",
  "bbva",
  "nequi",
  "daviplata",
  "rappicard",
  "rappipay",
  "google_wallet",
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
