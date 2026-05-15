import { requireFinancialAccountId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

export function buildDefaultFinancialAccountId(userId: string): FinancialAccountId {
  return requireFinancialAccountId(`fa-default-${userId}`);
}
