import { format } from "date-fns";
import type { FinancialAccountKind } from "@/features/financial-accounts/schema";
import { getDateFnsLocale } from "@/shared/i18n";
import { parseOptionalIsoDate } from "@/shared/lib";

export function getOpeningBalanceLabelKey(kind: FinancialAccountKind) {
  return kind === "credit_card"
    ? "financialAccounts.detail.startingDebtLabel"
    : "financialAccounts.detail.openingBalanceLabel";
}

export function formatOpeningBalanceEffectiveDate({
  effectiveDate,
  fallback,
  locale,
}: {
  readonly effectiveDate: string | null | undefined;
  readonly fallback: string;
  readonly locale: string;
}) {
  if (!effectiveDate) {
    return fallback;
  }

  const parsedDate = parseOptionalIsoDate(effectiveDate);

  return parsedDate ? format(parsedDate, "PPP", { locale: getDateFnsLocale(locale) }) : fallback;
}
