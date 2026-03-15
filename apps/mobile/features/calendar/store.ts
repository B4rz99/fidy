import { addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { create } from "zustand";
import { toTransactionRow } from "@/features/transactions/lib/build-transaction";
import {
  enqueueSync,
  insertTransaction,
  softDeleteTransaction,
} from "@/features/transactions/lib/repository";
import type { StoredTransaction } from "@/features/transactions/schema";
import { useTransactionStore } from "@/features/transactions/store";
import type { AnyDb } from "@/shared/db/client";
import { parseIsoDate, toIsoDate } from "@/shared/lib/format-date";
import { generateId } from "@/shared/lib/generate-id";
import { captureError } from "@/shared/lib/sentry";
import { requestNotificationPermissions, scheduleBillNotifications } from "./lib/notifications";
import {
  deleteBill as dbDeleteBill,
  deleteBillPayment as dbDeleteBillPayment,
  updateBill as dbUpdateBill,
  getAllBills,
  getBillPaymentsForMonth,
  insertBill,
  insertBillPayment,
} from "./lib/repository";
import {
  type Bill,
  type BillFrequency,
  type BillPayment,
  createBillSchema,
  fromBillRow,
  toBillRow,
} from "./schema";

// Module-level refs: Zustand doesn't serialize DB connections, so we keep them outside the store.
let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

type CalendarState = {
  currentMonth: Date;
  bills: Bill[];
  payments: BillPayment[];
  isLoading: boolean;
};

type CalendarActions = {
  initStore: (db: AnyDb, userId: string) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  loadBills: () => Promise<void>;
  loadPaymentsForMonth: () => Promise<void>;
  addBill: (
    name: string,
    amount: string,
    frequency: BillFrequency,
    category: string,
    startDate: Date
  ) => Promise<boolean>;
  updateBill: (
    id: string,
    fields: Partial<
      Pick<Bill, "name" | "amountCents" | "frequency" | "categoryId" | "startDate" | "isActive">
    >
  ) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  markBillPaid: (billId: string, dueDate: string) => Promise<void>;
  unmarkBillPaid: (billId: string, dueDate: string) => Promise<void>;
};

export const useCalendarStore = create<CalendarState & CalendarActions>((set, get) => ({
  currentMonth: new Date(),
  bills: [],
  payments: [],
  isLoading: false,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
  },

  nextMonth: () => {
    set((s) => ({ currentMonth: addMonths(s.currentMonth, 1) }));
    get().loadPaymentsForMonth().catch(captureError);
  },

  prevMonth: () => {
    set((s) => ({ currentMonth: subMonths(s.currentMonth, 1) }));
    get().loadPaymentsForMonth().catch(captureError);
  },

  loadBills: async () => {
    if (!dbRef || !userIdRef) return;
    set({ isLoading: true });
    try {
      const rows = await getAllBills(dbRef, userIdRef);
      set({ bills: rows.map(fromBillRow), isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadPaymentsForMonth: async () => {
    if (!dbRef) return;
    const { currentMonth } = get();
    const startIso = toIsoDate(startOfMonth(currentMonth));
    const endIso = toIsoDate(endOfMonth(currentMonth));
    try {
      const rows = await getBillPaymentsForMonth(dbRef, startIso, endIso);
      set({ payments: rows as BillPayment[] });
    } catch (error) {
      // keep existing payments on error
      throw error;
    }
  },

  addBill: async (name, amount, frequency, category, startDate) => {
    if (!dbRef || !userIdRef) return false;

    const cents = Math.round(parseFloat(amount) * 100);
    if (Number.isNaN(cents)) return false;

    const result = createBillSchema.safeParse({
      name,
      amountCents: cents,
      frequency,
      categoryId: category,
      startDate,
      isActive: true,
    });

    if (!result.success) return false;

    const newBill: Bill = {
      id: generateId("bill"),
      ...result.data,
    };

    try {
      await insertBill(dbRef, toBillRow(newBill, userIdRef, new Date().toISOString()));
    } catch {
      return false;
    }

    set((s) => ({
      bills: [...s.bills, newBill],
    }));

    // Schedule notifications (best-effort, don't block the add)
    requestNotificationPermissions()
      .then((granted) => (granted ? scheduleBillNotifications(newBill) : undefined))
      .catch(captureError);

    return true;
  },

  updateBill: async (id, fields) => {
    if (!dbRef) return;

    const dbFields = Object.fromEntries(
      Object.entries(fields)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, k === "startDate" && v instanceof Date ? v.toISOString() : v])
    );

    await dbUpdateBill(dbRef, id, dbFields, new Date().toISOString());
    set((s) => ({
      bills: s.bills.map((b) => (b.id === id ? { ...b, ...fields } : b)),
    }));
  },

  deleteBill: async (id) => {
    if (!dbRef) return;
    await dbDeleteBill(dbRef, id);
    set((s) => ({
      bills: s.bills.filter((b) => b.id !== id),
      payments: s.payments.filter((p) => p.billId !== id),
    }));
  },

  markBillPaid: async (billId, dueDate) => {
    if (!dbRef || !userIdRef) return;

    const bill = get().bills.find((b) => b.id === billId);
    if (!bill) return;

    const now = new Date();
    const nowIso = now.toISOString();

    // Create an expense transaction for this bill payment
    const txId = generateId("tx");
    const transaction: StoredTransaction = {
      id: txId,
      userId: userIdRef,
      type: "expense",
      amountCents: bill.amountCents,
      categoryId: bill.categoryId,
      description: bill.name,
      date: parseIsoDate(dueDate),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const payment: BillPayment = {
      id: generateId("pay"),
      billId,
      dueDate,
      paidAt: nowIso,
      transactionId: txId,
      createdAt: nowIso,
    };

    try {
      dbRef.transaction((tx) => {
        const db = tx as unknown as AnyDb;
        insertTransaction(db, toTransactionRow(transaction));
        enqueueSync(db, {
          id: generateId("sq"),
          tableName: "transactions",
          rowId: txId,
          operation: "insert",
          createdAt: nowIso,
        });
        insertBillPayment(db, payment);
      });

      set((s) => ({ payments: [...s.payments, payment] }));
      useTransactionStore.getState().addToCache(transaction);
    } catch {
      // Transaction rolled back — state unchanged
    }
  },

  unmarkBillPaid: async (billId, dueDate) => {
    if (!dbRef) return;

    const payment = get().payments.find((p) => p.billId === billId && p.dueDate === dueDate);
    const nowIso = new Date().toISOString();

    try {
      dbRef.transaction((tx) => {
        const db = tx as unknown as AnyDb;
        if (payment?.transactionId) {
          softDeleteTransaction(db, payment.transactionId, nowIso);
          enqueueSync(db, {
            id: generateId("sq"),
            tableName: "transactions",
            rowId: payment.transactionId,
            operation: "delete",
            createdAt: nowIso,
          });
        }
        dbDeleteBillPayment(db, billId, dueDate);
      });

      if (payment?.transactionId) {
        useTransactionStore.getState().removeFromCache(payment.transactionId);
      }
      set((s) => ({
        payments: s.payments.filter((p) => !(p.billId === billId && p.dueDate === dueDate)),
      }));
    } catch {
      // DB operation failed — keep state unchanged
    }
  },
}));
