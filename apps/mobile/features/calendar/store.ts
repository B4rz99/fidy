import { addMonths, subMonths } from "date-fns";
import { create } from "zustand";
import { useTransactionStore } from "@/features/transactions";
import { createWriteThroughMutationModule } from "@/mutations";
import type { AnyDb } from "@/shared/db";
import { captureError, trackBillCreated, trackBillPaymentRecorded } from "@/shared/lib";
import type { BillId, CategoryId, IsoDate, UserId } from "@/shared/types/branded";
import { createCalendarBillMutationService } from "./lib/bill-mutation-service";
import { requestNotificationPermissions, scheduleBillNotifications } from "./lib/notifications";
import type { Bill, BillFrequency, BillPayment } from "./schema";
import { createCalendarQueryService } from "./services/create-calendar-query-service";

let loadBillsRequestId = 0;
let loadPaymentsRequestId = 0;
let calendarSessionId = 0;

const calendarQueryService = createCalendarQueryService();

type CalendarState = {
  readonly activeUserId: UserId | null;
  readonly currentMonth: Date;
  readonly bills: Bill[];
  readonly payments: BillPayment[];
  readonly isLoading: boolean;
};

type CalendarActions = {
  beginSession: (userId: UserId) => void;
  setCurrentMonth: (currentMonth: Date) => void;
  setBills: (bills: readonly Bill[]) => void;
  setPayments: (payments: readonly BillPayment[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  appendBill: (bill: Bill) => void;
  replaceBill: (
    id: BillId,
    fields: Partial<
      Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
    >
  ) => void;
  removeBill: (id: BillId) => void;
  appendPayment: (payment: BillPayment) => void;
  removePayment: (billId: BillId, dueDate: IsoDate) => void;
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

function isCurrentBillsRequest(requestId: number, userId: UserId, sessionId: number): boolean {
  return (
    loadBillsRequestId === requestId &&
    useCalendarStore.getState().activeUserId === userId &&
    calendarSessionId === sessionId
  );
}

function isCurrentPaymentsRequest(
  requestId: number,
  userId: UserId,
  requestedMonth: Date,
  sessionId: number
): boolean {
  return (
    loadPaymentsRequestId === requestId &&
    useCalendarStore.getState().activeUserId === userId &&
    useCalendarStore.getState().currentMonth.getTime() === requestedMonth.getTime() &&
    calendarSessionId === sessionId
  );
}

function isActiveCalendarSession(userId: UserId, sessionId: number): boolean {
  return calendarSessionId === sessionId && useCalendarStore.getState().activeUserId === userId;
}

function createLiveCalendarBillMutations(db: AnyDb, userId: UserId) {
  const mutations = createWriteThroughMutationModule(db);

  return createCalendarBillMutationService({
    getCommit: () => mutations.commit,
    getUserId: () => userId,
    requestNotificationPermissions,
    scheduleBillNotifications,
    reportAsyncError: captureError,
    addTransactionToCache: (transaction) => useTransactionStore.getState().addToCache(transaction),
    removeTransactionFromCache: (transactionId) =>
      useTransactionStore.getState().removeFromCache(transactionId),
    trackCreated: trackBillCreated,
    trackPaymentRecorded: trackBillPaymentRecorded,
  });
}

export function initializeCalendarSession(userId: UserId): void {
  calendarSessionId += 1;
  loadBillsRequestId += 1;
  loadPaymentsRequestId += 1;
  useCalendarStore.getState().beginSession(userId);
}

export async function loadBills(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadBillsRequestId;
  const sessionId = calendarSessionId;
  useCalendarStore.getState().setIsLoading(true);

  try {
    const bills = await calendarQueryService.loadBills({ db, userId });
    if (!isCurrentBillsRequest(requestId, userId, sessionId)) {
      if (loadBillsRequestId === requestId) {
        useCalendarStore.getState().setIsLoading(false);
      }
      return;
    }
    useCalendarStore.getState().setBills(bills);
  } catch (error) {
    if (loadBillsRequestId === requestId) {
      useCalendarStore.getState().setIsLoading(false);
    }
    throw error;
  }
}

export async function loadPaymentsForMonth(db: AnyDb): Promise<void> {
  const userId = useCalendarStore.getState().activeUserId;
  if (!userId) return;

  const requestId = ++loadPaymentsRequestId;
  const sessionId = calendarSessionId;
  const requestedMonth = useCalendarStore.getState().currentMonth;

  const payments = await calendarQueryService.loadPaymentsForMonth({
    db,
    month: requestedMonth,
  });

  if (!isCurrentPaymentsRequest(requestId, userId, requestedMonth, sessionId)) {
    return;
  }

  useCalendarStore.getState().setPayments(payments);
}

export async function nextMonth(db: AnyDb): Promise<void> {
  const next = addMonths(useCalendarStore.getState().currentMonth, 1);
  useCalendarStore.getState().setCurrentMonth(next);
  await loadPaymentsForMonth(db);
}

export async function prevMonth(db: AnyDb): Promise<void> {
  const previous = subMonths(useCalendarStore.getState().currentMonth, 1);
  useCalendarStore.getState().setCurrentMonth(previous);
  await loadPaymentsForMonth(db);
}

export async function addBill(
  db: AnyDb,
  userId: UserId,
  name: string,
  amount: string,
  frequency: BillFrequency,
  categoryId: CategoryId,
  startDate: Date
): Promise<boolean> {
  const sessionId = calendarSessionId;
  const result = await createLiveCalendarBillMutations(db, userId).addBill({
    name,
    amount,
    frequency,
    categoryId,
    startDate,
  });
  if (!result.success) return false;
  if (!isActiveCalendarSession(userId, sessionId)) return false;

  useCalendarStore.getState().appendBill(result.bill);
  return true;
}

export async function updateBill(
  db: AnyDb,
  userId: UserId,
  id: BillId,
  fields: Partial<
    Pick<Bill, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
  >
): Promise<boolean> {
  const sessionId = calendarSessionId;
  const didUpdate = await createLiveCalendarBillMutations(db, userId).updateBill(id, fields);
  if (!didUpdate) return false;
  if (!isActiveCalendarSession(userId, sessionId)) return false;

  useCalendarStore.getState().replaceBill(id, fields);
  return true;
}

export async function deleteBill(db: AnyDb, userId: UserId, id: BillId): Promise<void> {
  const sessionId = calendarSessionId;
  const didDelete = await createLiveCalendarBillMutations(db, userId).deleteBill(id);
  if (!didDelete) return;
  if (!isActiveCalendarSession(userId, sessionId)) return;

  useCalendarStore.getState().removeBill(id);
}

export async function markBillPaid(
  db: AnyDb,
  userId: UserId,
  billId: BillId,
  dueDate: IsoDate
): Promise<void> {
  const sessionId = calendarSessionId;
  const result = await createLiveCalendarBillMutations(db, userId).markBillPaid(
    useCalendarStore.getState().bills,
    billId,
    dueDate
  );
  if (!result.success) return;
  if (!isActiveCalendarSession(userId, sessionId)) return;

  useCalendarStore.getState().appendPayment(result.payment);
}

export async function unmarkBillPaid(
  db: AnyDb,
  userId: UserId,
  billId: BillId,
  dueDate: IsoDate
): Promise<void> {
  const sessionId = calendarSessionId;
  const result = await createLiveCalendarBillMutations(db, userId).unmarkBillPaid(
    useCalendarStore.getState().payments,
    billId,
    dueDate
  );
  if (!result.success) return;
  if (!isActiveCalendarSession(userId, sessionId)) return;

  useCalendarStore.getState().removePayment(billId, dueDate);
}
