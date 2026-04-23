import { create } from "zustand";
import type { AnyDb } from "@/shared/db";
import type { BillId, CategoryId, IsoDate, UserId } from "@/shared/types/branded";
import type { Bill, BillFrequency, BillPayment } from "../schema";

export type BillDraft = {
  readonly amount: string;
  readonly categoryId: CategoryId;
  readonly frequency: BillFrequency;
  readonly name: string;
  readonly startDate: Date;
};

export type BillChanges = Partial<
  Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
>;

export type CalendarActor = {
  readonly db: AnyDb;
  readonly userId: UserId;
};

export type AddBillCommand = CalendarActor & {
  readonly draft: BillDraft;
};

export type UpdateBillCommand = CalendarActor & {
  readonly billId: BillId;
  readonly changes: BillChanges;
};

export type DeleteBillCommand = CalendarActor & {
  readonly billId: BillId;
};

export type BillPaymentCommand = CalendarActor & {
  readonly billId: BillId;
  readonly dueDate: IsoDate;
};

export type CalendarMutationSession = {
  readonly sessionId: number;
  readonly userId: UserId;
};

type CalendarState = {
  readonly activeUserId: UserId | null;
  readonly bills: Bill[];
  readonly currentMonth: Date;
  readonly isLoading: boolean;
  readonly payments: BillPayment[];
};

type CalendarActions = {
  appendBill: (bill: Bill) => void;
  appendPayment: (payment: BillPayment) => void;
  beginSession: (userId: UserId) => void;
  removeBill: (id: BillId) => void;
  removePayment: (billId: BillId, dueDate: IsoDate) => void;
  replaceBill: (id: BillId, fields: BillChanges) => void;
  setBills: (bills: readonly Bill[]) => void;
  setCurrentMonth: (currentMonth: Date) => void;
  setIsLoading: (isLoading: boolean) => void;
  setPayments: (payments: readonly BillPayment[]) => void;
};

export const useCalendarStore = create<CalendarState & CalendarActions>((set) => ({
  activeUserId: null,
  currentMonth: new Date(),
  bills: [],
  payments: [],
  isLoading: false,

  beginSession: (userId) =>
    set({
      activeUserId: userId,
      bills: [],
      payments: [],
      isLoading: false,
    }),

  setCurrentMonth: (currentMonth) => set({ currentMonth }),

  setBills: (bills) => set({ bills: [...bills], isLoading: false }),

  setPayments: (payments) => set({ payments: [...payments] }),

  setIsLoading: (isLoading) => set({ isLoading }),

  appendBill: (bill) => set((state) => ({ bills: [...state.bills, bill] })),

  replaceBill: (id, fields) =>
    set((state) => ({
      bills: state.bills.map((bill) => (bill.id === id ? { ...bill, ...fields } : bill)),
    })),

  removeBill: (id) =>
    set((state) => ({
      bills: state.bills.filter((bill) => bill.id !== id),
      payments: state.payments.filter((payment) => payment.billId !== id),
    })),

  appendPayment: (payment) => set((state) => ({ payments: [...state.payments, payment] })),

  removePayment: (billId, dueDate) =>
    set((state) => ({
      payments: state.payments.filter(
        (payment) => !(payment.billId === billId && payment.dueDate === dueDate)
      ),
    })),
}));
