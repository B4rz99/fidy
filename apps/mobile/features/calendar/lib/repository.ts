import { and, between, eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { billPayments, bills } from "@/shared/db/schema";

export type BillRow = typeof bills.$inferInsert;
export type BillPaymentRow = typeof billPayments.$inferInsert;

export async function insertBill(db: AnyDb, row: BillRow) {
  await db.insert(bills).values(row);
}

export async function getAllBills(db: AnyDb, userId: string) {
  return db.select().from(bills).where(eq(bills.userId, userId));
}

export async function updateBill(db: AnyDb, id: string, fields: Partial<BillRow>) {
  await db
    .update(bills)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(eq(bills.id, id));
}

export async function deleteBill(db: AnyDb, id: string) {
  await db.delete(billPayments).where(eq(billPayments.billId, id));
  await db.delete(bills).where(eq(bills.id, id));
}

export async function insertBillPayment(db: AnyDb, row: BillPaymentRow) {
  await db.insert(billPayments).values(row);
}

export async function getBillPaymentsForMonth(db: AnyDb, startIso: string, endIso: string) {
  return db
    .select()
    .from(billPayments)
    .where(between(billPayments.dueDate, startIso, endIso));
}

export async function deleteBillPayment(db: AnyDb, billId: string, dueDate: string) {
  await db
    .delete(billPayments)
    .where(and(eq(billPayments.billId, billId), eq(billPayments.dueDate, dueDate)));
}
