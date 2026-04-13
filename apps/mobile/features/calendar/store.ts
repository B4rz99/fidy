import { addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { create } from "zustand";
import { useTransactionStore } from "@/features/transactions";
import type { AnyDb } from "@/shared/db";
import { captureError, toIsoDate, trackBillCreated, trackBillPaymentRecorded } from "@/shared/lib";
import {
  createWriteThroughMutationModule,
  type WriteThroughMutationModule,
} from "@/shared/mutations";
import type { BillId, CategoryId, IsoDate, UserId } from "@/shared/types/branded";
import { createCalendarBillMutationService } from "./lib/bill-mutation-service";
import { requestNotificationPermissions, scheduleBillNotifications } from "./lib/notifications";
import { getAllBills, getBillPaymentsForMonth } from "./lib/repository";
import { type Bill, type BillFrequency, type BillPayment, fromBillRow } from "./schema";

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

export const useCalendarStore = create<CalendarState & CalendarActions>((set, get) => {
  const billMutations = createCalendarBillMutationService({
    getCommit: () => mutations?.commit ?? null,
    getUserId: () => userIdRef,
    requestNotificationPermissions,
    scheduleBillNotifications,
    reportAsyncError: captureError,
    addTransactionToCache: (transaction) => useTransactionStore.getState().addToCache(transaction),
    removeTransactionFromCache: (transactionId) =>
      useTransactionStore.getState().removeFromCache(transactionId),
    trackCreated: trackBillCreated,
    trackPaymentRecorded: trackBillPaymentRecorded,
  });

  return {
    currentMonth: new Date(),
    bills: [],
    payments: [],
    isLoading: false,

    initStore: (db, userId) => {
      dbRef = db;
      userIdRef = userId;
      mutations = db ? createWriteThroughMutationModule(db) : null;
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
      const result = await billMutations.addBill({
        name,
        amount,
        frequency,
        categoryId: category,
        startDate,
      });
      if (!result.success) return false;

      set((s) => ({
        bills: [...s.bills, result.bill],
      }));

      return true;
    },

    updateBill: async (id, fields) => {
      const didUpdate = await billMutations.updateBill(id, fields);
      if (!didUpdate) return;
      set((s) => ({
        bills: s.bills.map((b) => (b.id === id ? { ...b, ...fields } : b)),
      }));
    },

    deleteBill: async (id) => {
      const didDelete = await billMutations.deleteBill(id);
      if (!didDelete) return;
      set((s) => ({
        bills: s.bills.filter((b) => b.id !== id),
        payments: s.payments.filter((p) => p.billId !== id),
      }));
    },

    markBillPaid: async (billId, dueDate) => {
      const result = await billMutations.markBillPaid(get().bills, billId, dueDate);
      if (!result.success) return;
      set((s) => ({ payments: [...s.payments, result.payment] }));
    },

    unmarkBillPaid: async (billId, dueDate) => {
      const result = await billMutations.unmarkBillPaid(get().payments, billId, dueDate);
      if (!result.success) return;
      set((s) => ({
        payments: s.payments.filter((p) => !(p.billId === billId && p.dueDate === dueDate)),
      }));
    },
  };
});
