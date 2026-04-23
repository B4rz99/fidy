import { requireFinancialAccountId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

export function parseFinancialAccountRouteParam(
  value: string | string[] | undefined
): FinancialAccountId | null {
  const routeValue = Array.isArray(value) ? value[0] : value;

  if (!routeValue || routeValue.trim().length === 0) {
    return null;
  }

  try {
    return requireFinancialAccountId(routeValue);
  } catch {
    return null;
  }
}
