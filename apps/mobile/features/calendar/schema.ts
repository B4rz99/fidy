import { z } from "zod";
import { categoryIdSchema } from "@/features/transactions";
import { toIsoDate } from "@/shared/lib";
import type {
  BillId,
  BillPaymentId,
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export const billFrequency = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
export type BillFrequency = z.infer<typeof billFrequency>;

export const FREQUENCIES: { value: BillFrequency; labelKey: string }[] = [
  { value: "weekly", labelKey: "bills.weekly" },
  { value: "biweekly", labelKey: "bills.biweekly" },
  { value: "monthly", labelKey: "bills.monthly" },
  { value: "yearly", labelKey: "bills.yearly" },
];

export const billSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  amount: z.number().int().positive(),
  frequency: billFrequency,
  categoryId: categoryIdSchema,
  startDate: z.date(),
  isActive: z.boolean(),
});

export type Bill = z.infer<typeof billSchema>;

export const createBillSchema = billSchema.omit({ id: true });
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const billPaymentSchema = z.object({
  id: z.string(),
  billId: z.string(),
  dueDate: z.string(),
  paidAt: z.string(),
  transactionId: z.string().nullable(),
  createdAt: z.string(),
});

export type BillPayment = {
  readonly id: BillPaymentId;
  readonly billId: BillId;
  readonly dueDate: IsoDate;
  readonly paidAt: IsoDateTime;
  readonly transactionId: TransactionId | null;
  readonly createdAt: IsoDateTime;
};

/** Convert a Bill (runtime, with Date) to a DB row (with ISO strings). */
export function toBillRow(
  bill: Bill,
  userId: UserId,
  now: IsoDateTime
): {
  id: BillId;
  userId: UserId;
  name: string;
  amount: CopAmount;
  frequency: string;
  categoryId: CategoryId;
  startDate: IsoDate;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
} {
  return {
    id: bill.id as BillId,
    userId,
    name: bill.name,
    amount: bill.amount as CopAmount,
    frequency: bill.frequency,
    categoryId: bill.categoryId as CategoryId,
    startDate: toIsoDate(bill.startDate),
    isActive: bill.isActive,
    createdAt: now,
    updatedAt: now,
  };
}

/** Convert a DB row (with ISO strings) back to a Bill (with Date). */
export function fromBillRow(row: {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  categoryId: string;
  startDate: string;
  isActive: boolean;
}): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    frequency: row.frequency as BillFrequency,
    categoryId: row.categoryId as CategoryId,
    startDate: new Date(row.startDate),
    isActive: row.isActive,
  };
}
