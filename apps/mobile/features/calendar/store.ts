import { addMonths, subMonths } from "date-fns";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import { createCalendarQueryService } from "./services/create-calendar-query-service";
import { createLiveCalendarBillMutations } from "./store/live-bill-mutations";
import {
  applyMutationIfSessionIsActive,
  beginBillsLoadRequest,
  beginCalendarSession,
  beginPaymentsLoadRequest,
  captureCalendarMutationSession,
  isCurrentBillsRequest,
  isCurrentPaymentsRequest,
  stopBillsLoading,
} from "./store/session";
import {
  type AddBillCommand,
  type BillPaymentCommand,
  type DeleteBillCommand,
  type UpdateBillCommand,
  useCalendarStore,
} from "./store/state";

const calendarQueryService = createCalendarQueryService();

export { useCalendarStore } from "./store/state";

export function initializeCalendarSession(userId: UserId): void {
  beginCalendarSession(userId);
}

export async function loadBills(db: AnyDb, userId: UserId): Promise<void> {
  const request = beginBillsLoadRequest(userId);

  try {
    const bills = await calendarQueryService.loadBills({ db, userId });

    if (!isCurrentBillsRequest(request)) {
      stopBillsLoading(request.requestId);
      return;
    }

    useCalendarStore.getState().setBills(bills);
  } catch (error) {
    stopBillsLoading(request.requestId);
    throw error;
  }
}

export async function loadPaymentsForMonth(db: AnyDb): Promise<void> {
  const request = beginPaymentsLoadRequest();
  if (!request.userId) return;

  const payments = await calendarQueryService.loadPaymentsForMonth({
    db,
    month: request.requestedMonth,
  });

  if (!isCurrentPaymentsRequest(request)) {
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

export async function addBill(command: AddBillCommand): Promise<boolean> {
  const { db, userId, draft } = command;
  const session = captureCalendarMutationSession(userId);
  const result = await createLiveCalendarBillMutations({ db, userId }).addBill(draft);
  if (!result.success) return false;

  return applyMutationIfSessionIsActive(session, () => {
    useCalendarStore.getState().appendBill(result.bill);
  });
}

export async function updateBill(command: UpdateBillCommand): Promise<boolean> {
  const { db, userId, billId, changes } = command;
  const session = captureCalendarMutationSession(userId);
  const didUpdate = await createLiveCalendarBillMutations({ db, userId }).updateBill(
    billId,
    changes
  );
  if (!didUpdate) return false;

  return applyMutationIfSessionIsActive(session, () => {
    useCalendarStore.getState().replaceBill(billId, changes);
  });
}

export async function deleteBill(command: DeleteBillCommand): Promise<void> {
  const { db, userId, billId } = command;
  const session = captureCalendarMutationSession(userId);
  const didDelete = await createLiveCalendarBillMutations({ db, userId }).deleteBill(billId);
  if (!didDelete) return;

  applyMutationIfSessionIsActive(session, () => {
    useCalendarStore.getState().removeBill(billId);
  });
}

export async function markBillPaid(command: BillPaymentCommand): Promise<void> {
  const { db, userId, billId, dueDate } = command;
  const session = captureCalendarMutationSession(userId);
  const result = await createLiveCalendarBillMutations({ db, userId }).markBillPaid(
    useCalendarStore.getState().bills,
    billId,
    dueDate
  );
  if (!result.success) return;

  applyMutationIfSessionIsActive(session, () => {
    useCalendarStore.getState().appendPayment(result.payment);
  });
}

export async function unmarkBillPaid(command: BillPaymentCommand): Promise<void> {
  const { db, userId, billId, dueDate } = command;
  const session = captureCalendarMutationSession(userId);
  const result = await createLiveCalendarBillMutations({ db, userId }).unmarkBillPaid(
    useCalendarStore.getState().payments,
    billId,
    dueDate
  );
  if (!result.success) return;

  applyMutationIfSessionIsActive(session, () => {
    useCalendarStore.getState().removePayment(billId, dueDate);
  });
}
