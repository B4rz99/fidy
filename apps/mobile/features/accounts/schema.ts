import { z } from "zod";
import type { AccountId, CopAmount, IsoDate, IsoDateTime, UserId } from "@/shared/types/branded";

export const accountClassSchema = z.enum(["asset", "liability"]);
export type AccountClass = z.infer<typeof accountClassSchema>;

export const accountSubtypeSchema = z.enum([
  "checking",
  "savings",
  "cash",
  "digital_holding",
  "credit_card",
  "loan",
  "investment",
  "other",
]);
export type AccountSubtype = z.infer<typeof accountSubtypeSchema>;

export const accountSystemKeySchema = z.enum(["default_cash", "default_digital_holding"]);
export type AccountSystemKey = z.infer<typeof accountSystemKeySchema>;

export type Account = {
  readonly id: AccountId;
  readonly userId: UserId;
  readonly systemKey: AccountSystemKey | null;
  readonly accountClass: AccountClass;
  readonly accountSubtype: AccountSubtype;
  readonly name: string;
  readonly institution: string;
  readonly last4: string | null;
  readonly baselineAmount: CopAmount;
  readonly baselineDate: IsoDate;
  readonly creditLimit: CopAmount | null;
  readonly closingDay: number | null;
  readonly dueDay: number | null;
  readonly archivedAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
};
