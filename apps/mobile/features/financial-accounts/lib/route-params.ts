import { requireFinancialAccountId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

export function parseFinancialAccountRouteParam(
  value: string | undefined
): FinancialAccountId | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  try {
    return requireFinancialAccountId(value);
  } catch {
    return null;
  }
}
