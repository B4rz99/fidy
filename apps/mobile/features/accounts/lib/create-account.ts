import {
  cleanDigitInput,
  generateAccountId,
  parseDigitsToAmount,
  toIsoDate,
  toIsoDateTime,
} from "@/shared/lib";
import type { AccountId, UserId } from "@/shared/types/branded";
import { type AccountClass, type AccountSubtype, accountSubtypeSchema } from "../schema";
import type { AccountRow } from "./repository";

export type CreateAccountInput = {
  readonly subtype: string;
  readonly name: string;
  readonly institution: string;
  readonly last4?: string;
  readonly balanceDigits: string;
  readonly balanceDate: Date;
  readonly creditLimitDigits?: string;
  readonly closingDay?: string;
  readonly dueDay?: string;
};

type BuildCreateAccountDeps = {
  readonly now?: () => Date;
  readonly createId?: () => AccountId;
};

export const ACCOUNT_SUBTYPE_OPTIONS = [
  "checking",
  "savings",
  "cash",
  "credit_card",
  "loan",
  "investment",
  "other",
] as const satisfies readonly AccountSubtype[];

const LIABILITY_SUBTYPES = new Set<AccountSubtype>(["credit_card", "loan"]);

const ACCOUNT_SUBTYPE_LABEL_ENTRIES = new Map<AccountSubtype, string>([
  ["checking", "accounts.subtypes.checking"],
  ["savings", "accounts.subtypes.savings"],
  ["cash", "accounts.subtypes.cash"],
  ["digital_holding", "accounts.subtypes.digitalHolding"],
  ["credit_card", "accounts.subtypes.creditCard"],
  ["loan", "accounts.subtypes.loan"],
  ["investment", "accounts.subtypes.investment"],
  ["other", "accounts.subtypes.other"],
]);

const normalizeText = (value: string) => value.trim();

const normalizeDigits = (value?: string) => cleanDigitInput(value ?? "");

const toOptionalMoney = (value?: string) => {
  const digits = normalizeDigits(value);
  return digits.length === 0 ? null : parseDigitsToAmount(digits);
};

export const toOptionalDayOfMonth = (value?: string) => {
  const digits = normalizeDigits(value);

  if (digits.length === 0) return null;

  const parsed = Number.parseInt(digits, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
};

export const isDayOfMonthValidOrEmpty = (value?: string) => {
  const digits = normalizeDigits(value);
  return digits.length === 0 || toOptionalDayOfMonth(value) != null;
};

export const isLast4ValidOrEmpty = (value?: string) => {
  const digits = normalizeDigits(value);
  return digits.length === 0 || digits.length === 4;
};

const toOptionalLast4 = (value?: string) => {
  const digits = normalizeDigits(value);
  return digits.length === 4 ? digits : null;
};

export const deriveAccountClass = (subtype: AccountSubtype): AccountClass =>
  LIABILITY_SUBTYPES.has(subtype) ? "liability" : "asset";

export const isCreditCardSubtype = (subtype: AccountSubtype) => subtype === "credit_card";

export const getAccountSubtypeLabelKey = (subtype: AccountSubtype) =>
  ACCOUNT_SUBTYPE_LABEL_ENTRIES.get(subtype) ?? "accounts.subtypes.other";

const toCreditCardFields = (input: CreateAccountInput, subtype: AccountSubtype) =>
  isCreditCardSubtype(subtype)
    ? {
        creditLimit: toOptionalMoney(input.creditLimitDigits),
        closingDay: toOptionalDayOfMonth(input.closingDay),
        dueDay: toOptionalDayOfMonth(input.dueDay),
      }
    : {
        creditLimit: null,
        closingDay: null,
        dueDay: null,
      };

export function buildCreateAccountRow(
  input: CreateAccountInput,
  userId: UserId,
  deps: BuildCreateAccountDeps = {}
): AccountRow | null {
  const subtypeResult = accountSubtypeSchema.safeParse(input.subtype);
  const name = normalizeText(input.name);
  const institution = normalizeText(input.institution);

  if (!subtypeResult.success || !name || !institution) return null;
  if (!isLast4ValidOrEmpty(input.last4)) return null;
  if (!isDayOfMonthValidOrEmpty(input.closingDay)) return null;
  if (!isDayOfMonthValidOrEmpty(input.dueDay)) return null;

  const subtype = subtypeResult.data;
  const now = deps.now?.() ?? new Date();
  const createId = deps.createId ?? generateAccountId;
  const creditCardFields = toCreditCardFields(input, subtype);

  return {
    id: createId(),
    userId,
    systemKey: null,
    accountClass: deriveAccountClass(subtype),
    accountSubtype: subtype,
    name,
    institution,
    last4: toOptionalLast4(input.last4),
    baselineAmount: parseDigitsToAmount(normalizeDigits(input.balanceDigits)),
    baselineDate: toIsoDate(input.balanceDate),
    creditLimit: creditCardFields.creditLimit,
    closingDay: creditCardFields.closingDay,
    dueDay: creditCardFields.dueDay,
    archivedAt: null,
    createdAt: toIsoDateTime(now),
    updatedAt: toIsoDateTime(now),
  };
}
