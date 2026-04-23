import type { Bill } from "../../schema";

export function resolveBillIdParam(billId: string | string[] | undefined) {
  return Array.isArray(billId) ? billId[0] : billId;
}

export function resolveExistingBill(bills: readonly Bill[], billId: string | undefined) {
  return billId ? bills.find((bill) => bill.id === billId) : undefined;
}
