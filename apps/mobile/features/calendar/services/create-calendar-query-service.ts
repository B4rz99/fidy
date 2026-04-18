import { endOfMonth, startOfMonth } from "date-fns";
import type { AnyDb } from "@/shared/db";
import { toIsoDate } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { getAllBills, getBillPaymentsForMonth } from "../lib/repository";
import { type Bill, type BillPayment, fromBillRow } from "../schema";

type LoadBillsInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
};

type LoadPaymentsInput = {
  readonly db: AnyDb;
  readonly month: Date;
};

type CreateCalendarQueryServiceDeps = {
  readonly getAllBills?: typeof getAllBills;
  readonly getBillPaymentsForMonth?: typeof getBillPaymentsForMonth;
};

export function createCalendarQueryService({
  getAllBills: loadBills = getAllBills,
  getBillPaymentsForMonth: loadPayments = getBillPaymentsForMonth,
}: CreateCalendarQueryServiceDeps = {}) {
  return {
    loadBills: async ({ db, userId }: LoadBillsInput): Promise<readonly Bill[]> =>
      loadBills(db, userId).map(fromBillRow),

    loadPaymentsForMonth: async ({
      db,
      month,
    }: LoadPaymentsInput): Promise<readonly BillPayment[]> => {
      const startIso = toIsoDate(startOfMonth(month));
      const endIso = toIsoDate(endOfMonth(month));
      return loadPayments(db, startIso, endIso) as readonly BillPayment[];
    },
  };
}
