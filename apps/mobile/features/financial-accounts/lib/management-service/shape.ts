import type { CopAmount, IsoDate, IsoDateTime, UserId } from "@/shared/types/branded";
import type { OpeningBalanceRow } from "../opening-balances-repository";
import type { FinancialAccountRow } from "../repository";
import type {
  AccountShapeInput,
  BillingProfile,
  BillingProfileInput,
  NormalizedAccountShape,
  OpeningBalanceDraft,
  OpeningBalanceInput,
} from "./types";

function requireFinancialAccountName(name: string) {
  const normalizedName = name.trim();

  if (normalizedName.length === 0) {
    throw new Error("financial account name is required");
  }

  return normalizedName;
}

function hasPartialOpeningBalance(input: OpeningBalanceInput) {
  return input.amount != null || input.effectiveDate != null;
}

function hasMissingOpeningBalanceValue(input: OpeningBalanceInput) {
  return input.amount == null || input.effectiveDate == null;
}

function normalizeBillingDay(value: number | null, label: string) {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error(`${label} must be an integer between 1 and 31`);
  }

  return value;
}

function normalizeBillingProfile(input: BillingProfileInput): BillingProfile {
  if (input.kind !== "credit_card") {
    return {
      statementClosingDay: null,
      paymentDueDay: null,
    };
  }

  return {
    statementClosingDay: normalizeBillingDay(input.statementClosingDay, "statementClosingDay"),
    paymentDueDay: normalizeBillingDay(input.paymentDueDay, "paymentDueDay"),
  };
}

function normalizeOpeningBalance(input: OpeningBalanceInput): OpeningBalanceDraft | null {
  if (!hasPartialOpeningBalance(input)) {
    return null;
  }

  if (hasMissingOpeningBalanceValue(input)) {
    throw new Error("opening balance requires both amount and effective date");
  }

  return {
    amount: input.amount as CopAmount,
    effectiveDate: input.effectiveDate as IsoDate,
  };
}

export function trimOrNull(value: string | null) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function hasBillingProfileGap(
  account: Pick<FinancialAccountRow, "kind" | "statementClosingDay" | "paymentDueDay">
) {
  return (
    account.kind === "credit_card" &&
    (account.statementClosingDay == null || account.paymentDueDay == null)
  );
}

export function assertOwnedFinancialAccount(account: FinancialAccountRow | null, userId: UserId) {
  if (!account || account.deletedAt != null || account.userId !== userId) {
    throw new Error("financial account not found");
  }

  return account;
}

export function normalizeAccountShape(input: AccountShapeInput): NormalizedAccountShape {
  return {
    name: requireFinancialAccountName(input.name),
    kind: input.kind,
    billingProfile: normalizeBillingProfile({
      kind: input.kind,
      statementClosingDay: input.statementClosingDay,
      paymentDueDay: input.paymentDueDay,
    }),
    openingBalance: normalizeOpeningBalance({
      amount: input.openingBalanceAmount,
      effectiveDate: input.openingBalanceEffectiveDate,
    }),
  };
}

export function buildDeletedOpeningBalance(
  existingOpeningBalance: OpeningBalanceRow,
  updatedAt: IsoDateTime
) {
  return {
    ...existingOpeningBalance,
    updatedAt,
    deletedAt: updatedAt,
  };
}
