import { addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { create } from "zustand";
import { type StoredTransaction, toTransactionRow, useTransactionStore } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import {
  captureError,
  generateBillId,
  generateBillPaymentId,
  generateTransactionId,
  parseDigitsToAmount,
  parseIsoDate,
  toIsoDate,
  toIsoDateTime,
  trackBillCreated,
  trackBillPaymentRecorded,
} from "@/shared/lib";
import type { BillId, CategoryId, CopAmount, IsoDate, UserId } from "@/shared/types/branded";
import { createWriteThroughMutationModule, type WriteThroughMutationModule } from "@/shared/mutations";
import { requestNotificationPermissions, scheduleBillNotifications } from "./lib/notifications";
import {
  getAllBills,
  getBillPaymentsForMonth,
  type BillPaymentRow,
  type BillRow,
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
let userIdRef: UserId | null = null;
let mutations: WriteThroughMutationModule | null = null;

type CalendarState = {
  currentMonth: Date;
  bills: Bill[];
  payments: BillPayment[];
  isLoading: boolean;
};

type CalendarActions = {
  initStore: (db: AnyDb, userId: UserId) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  loadBills: () => Promise<void>;
  loadPaymentsForMonth: () => Promise<void>;
  addBill: (
    name: string,
    amount: string,
    frequency: BillFrequency,
    category: CategoryId,
    startDate: Date
  ) => Promise<boolean>;
  updateBill: (
    id: BillId,
    fields: Partial<
      Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
    >
  ) => Promise<void>;
  deleteBill: (id: BillId) => Promise<void>;
  markBillPaid: (billId: BillId, dueDate: IsoDate) => Promise<void>;
  unmarkBillPaid: (billId: BillId, dueDate: IsoDate) => Promise<void>;
};

export const useCalendarStore = create<CalendarState & CalendarActions>((set, get) => ({
  currentMonth: new Date(),
  bills: [],
  payments: [],
  isLoading: false,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    mutations = createWriteThroughMutationModule(db);
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
      const rows = getAllBills(dbRef, userIdRef);
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
    const rows = getBillPaymentsForMonth(dbRef, startIso, endIso);
    set({ payments: rows as BillPayment[] });
  },

  addBill: async (name, amount, frequency, category, startDate) => {
    if (!dbRef || !userIdRef) return false;

    const amountValue = parseDigitsToAmount(amount);
    if (amountValue <= 0) return false;

    const result = createBillSchema.safeParse({
      name,
      amount: amountValue,
      frequency,
      categoryId: category,
      startDate,
      isActive: true,
    });

    if (!result.success) return false;

    const newBill: Bill = {
      id: generateBillId(),
      ...result.data,
    };

    const mutationModule = mutations;
    if (!mutationModule) return false;

    try {
      const result = await mutationModule.commit({
        kind: "calendar.bill.save",
        row: toBillRow(newBill, userIdRef, toIsoDateTime(new Date())),
      });
      if (!result.success) return false;
    } catch {
      return false;
    }

    set((s) => ({
      bills: [...s.bills, newBill],
    }));

    trackBillCreated({ frequency });

    // Schedule notifications (best-effort, don't block the add)
    requestNotificationPermissions()
      .then((granted) => (granted ? scheduleBillNotifications(newBill) : undefined))
      .catch(captureError);

    return true;
  },

  updateBill: async (id, fields) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;

    const dbFields = Object.fromEntries(
      Object.entries(fields)
        .filter(([, v]) => v != null) // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- Partial<> fields may be undefined at runtime
        .map(([k, v]) => [k, k === "startDate" && v instanceof Date ? v.toISOString() : v])
    );

    const result = await mutationModule.commit({
      kind: "calendar.bill.update",
      billId: id,
      fields: dbFields as Partial<
        Pick<BillRow, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
      >,
      now: toIsoDateTime(new Date()),
    });
    if (!result.success) return;
    set((s) => ({
      bills: s.bills.map((b) => (b.id === id ? { ...b, ...fields } : b)),
    }));
  },

  deleteBill: async (id) => {
    if (!dbRef) return;
    const mutationModule = mutations;
    if (!mutationModule) return;
    const result = await mutationModule.commit({
      kind: "calendar.bill.delete",
      billId: id,
    });
    if (!result.success) return;
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
    const nowIso = toIsoDateTime(now);

    // Create an expense transaction for this bill payment
    const txId = generateTransactionId();
    const transaction: StoredTransaction = {
      id: txId,
      userId: userIdRef,
      type: "expense",
      amount: bill.amount as CopAmount,
      categoryId: bill.categoryId,
      description: bill.name,
      date: parseIsoDate(dueDate),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const payment: BillPayment = {
      id: generateBillPaymentId(),
      billId,
      dueDate,
      paidAt: nowIso,
      transactionId: txId,
      createdAt: nowIso,
    };

    const mutationModule = mutations;
    if (!mutationModule) return;

    try {
      const result = await mutationModule.commit({
        kind: "calendar.bill.markPaid",
        transactionRow: toTransactionRow(transaction),
        paymentRow: payment as BillPaymentRow,
      });
      if (!result.success) return;

      set((s) => ({ payments: [...s.payments, payment] }));
      useTransactionStore.getState().addToCache(transaction);
    } catch {
      return; // Transaction rolled back — state unchanged
    }
    trackBillPaymentRecorded();
  },

  unmarkBillPaid: async (billId, dueDate) => {
    if (!dbRef) return;

    const payment = get().payments.find((p) => p.billId === billId && p.dueDate === dueDate);
    const mutationModule = mutations;
    if (!mutationModule) return;
    const nowIso = toIsoDateTime(new Date());

    try {
      const result = await mutationModule.commit({
        kind: "calendar.bill.unmarkPaid",
        billId,
        dueDate,
        transactionId: payment?.transactionId ?? null,
        now: nowIso,
      });
      if (!result.success) return;

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
