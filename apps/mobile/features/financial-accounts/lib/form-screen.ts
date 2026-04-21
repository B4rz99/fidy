import type { FinancialAccountId } from "@/shared/types/branded";
import type { FinancialAccountKind } from "../schema";

type BillingDayInput = {
  readonly kind: FinancialAccountKind;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

type FinancialAccountFormScreenStateInput = {
  readonly accountId: FinancialAccountId | null;
  readonly lookupStatus: FinancialAccountFormLookupStatus;
};

export type FinancialAccountFormLookupStatus = "idle" | "loading" | "ready" | "missing";
export type FinancialAccountFormScreenState = "create" | "loading" | "edit" | "missing";

function isOutOfRangeBillingDay(day: number | null): boolean {
  return day != null && !Number.isNaN(day) && (day < 1 || day > 31);
}

export function hasInvalidBillingDayInput(input: BillingDayInput): boolean {
  if (input.kind !== "credit_card") {
    return false;
  }

  return (
    Number.isNaN(input.statementClosingDay) ||
    Number.isNaN(input.paymentDueDay) ||
    isOutOfRangeBillingDay(input.statementClosingDay) ||
    isOutOfRangeBillingDay(input.paymentDueDay)
  );
}

export function getFinancialAccountFormScreenState(
  input: FinancialAccountFormScreenStateInput
): FinancialAccountFormScreenState {
  if (input.accountId == null) {
    return "create";
  }

  if (input.lookupStatus === "ready") {
    return "edit";
  }

  if (input.lookupStatus === "missing") {
    return "missing";
  }

  return "loading";
}
