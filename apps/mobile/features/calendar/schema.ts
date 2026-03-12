import { z } from "zod";
import { categoryIdSchema } from "@/features/transactions/schema";

export const billFrequency = z.enum(["weekly", "biweekly", "monthly", "yearly"]);
export type BillFrequency = z.infer<typeof billFrequency>;

export const FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export const billSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  amountCents: z.number().int().positive(),
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

export type BillPayment = z.infer<typeof billPaymentSchema>;

/** Convert a Bill (runtime, with Date) to a DB row (with ISO strings). */
export function toBillRow(
  bill: Bill,
  userId: string
): {
  id: string;
  userId: string;
  name: string;
  amountCents: number;
  frequency: string;
  categoryId: string;
  startDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
} {
  const now = new Date().toISOString();
  return {
    id: bill.id,
    userId,
    name: bill.name,
    amountCents: bill.amountCents,
    frequency: bill.frequency,
    categoryId: bill.categoryId,
    startDate: bill.startDate.toISOString(),
    isActive: bill.isActive,
    createdAt: now,
    updatedAt: now,
  };
}

/** Convert a DB row (with ISO strings) back to a Bill (with Date). */
export function fromBillRow(row: {
  id: string;
  name: string;
  amountCents: number;
  frequency: string;
  categoryId: string;
  startDate: string;
  isActive: boolean;
}): Bill {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amountCents,
    frequency: row.frequency as BillFrequency,
    categoryId: row.categoryId as z.infer<typeof categoryIdSchema>,
    startDate: new Date(row.startDate),
    isActive: row.isActive,
  };
}
