import type { FinancialAccountKind } from "../schema";
import type { FinancialAccountId } from "@/shared/types/branded";

export type FinancialAccountFormLookupStatus = "idle" | "loading" | "ready" | "missing";
export type FinancialAccountFormScreenState = "create" | "loading" | "edit" | "missing";

function isOutOfRangeBillingDay(day: number | null): boolean {
  return day != null && !Number.isNaN(day) && (day < 1 || day > 31);
}

export function hasInvalidBillingDayInput({
  kind,
  statementClosingDay,
  paymentDueDay,
}: {
  readonly kind: FinancialAccountKind;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
}): boolean {
  if (kind !== "credit_card") {
    return false;
  }

  return (
    Number.isNaN(statementClosingDay) ||
    Number.isNaN(paymentDueDay) ||
    isOutOfRangeBillingDay(statementClosingDay) ||
    isOutOfRangeBillingDay(paymentDueDay)
  );
}

export function getFinancialAccountFormScreenState({
  accountId,
  lookupStatus,
}: {
  readonly accountId: FinancialAccountId | null;
  readonly lookupStatus: FinancialAccountFormLookupStatus;
}): FinancialAccountFormScreenState {
  if (accountId == null) {
    return "create";
  }

  if (lookupStatus === "ready") {
    return "edit";
  }

  if (lookupStatus === "missing") {
    return "missing";
  }

  return "loading";
}
