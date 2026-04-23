import { assertCopAmount } from "@/shared/types/assertions";
import type { BillUpdateFields as RepositoryBillUpdateFields } from "../repository";
import type { UpdateBillFields } from "./types";

export function toBillUpdateFields(fields: UpdateBillFields): RepositoryBillUpdateFields {
  const amount = fields.amount;
  if (amount != null) {
    assertCopAmount(amount);
  }

  return {
    ...(fields.name != null ? { name: fields.name } : {}),
    ...(amount != null ? { amount } : {}),
    ...(fields.frequency != null ? { frequency: fields.frequency } : {}),
    ...(fields.categoryId != null ? { categoryId: fields.categoryId } : {}),
    ...(fields.startDate != null ? { startDate: fields.startDate.toISOString() } : {}),
    ...(fields.isActive != null ? { isActive: fields.isActive } : {}),
  };
}
