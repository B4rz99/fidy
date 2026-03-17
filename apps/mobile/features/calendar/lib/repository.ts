import { and, between, eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { billPayments, bills } from "@/shared/db";

export type BillRow = typeof bills.$inferInsert;
export type BillPaymentRow = typeof billPayments.$inferInsert;

export function insertBill(db: AnyDb, row: BillRow) {
  db.insert(bills).values(row).run();
}

export function getAllBills(db: AnyDb, userId: string) {
  return db.select().from(bills).where(eq(bills.userId, userId)).all();
}

export function updateBill(db: AnyDb, id: string, fields: Partial<BillRow>, now: string) {
  db.update(bills)
    .set({ ...fields, updatedAt: now })
    .where(eq(bills.id, id))
    .run();
}

export function deleteBill(db: AnyDb, id: string) {
  db.delete(billPayments).where(eq(billPayments.billId, id)).run();
  db.delete(bills).where(eq(bills.id, id)).run();
}

export function insertBillPayment(db: AnyDb, row: BillPaymentRow) {
  db.insert(billPayments).values(row).run();
}

export function getBillPaymentsForMonth(db: AnyDb, startIso: string, endIso: string) {
  return db
    .select()
    .from(billPayments)
    .where(between(billPayments.dueDate, startIso, endIso))
    .all();
}

export function deleteBillPayment(db: AnyDb, billId: string, dueDate: string) {
  db.delete(billPayments)
    .where(and(eq(billPayments.billId, billId), eq(billPayments.dueDate, dueDate)))
    .run();
}
