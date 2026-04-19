import type { FinancialAccountId } from "@/shared/types/branded";

export function buildDefaultFinancialAccountId(userId: string): FinancialAccountId {
  return `fa-default-${userId}` as FinancialAccountId;
}
