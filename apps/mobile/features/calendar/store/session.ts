import type { UserId } from "@/shared/types/branded";
import type { CalendarMutationSession } from "./state";
import { useCalendarStore } from "./state";

type BillsLoadRequest = {
  readonly requestId: number;
  readonly sessionId: number;
  readonly userId: UserId;
};

type PaymentsLoadRequest = {
  readonly requestId: number;
  readonly requestedMonth: Date;
  readonly sessionId: number;
  readonly userId: UserId | null;
};

let loadBillsRequestId = 0;
let loadPaymentsRequestId = 0;
let calendarSessionId = 0;

function isActiveCalendarSession(userId: UserId, sessionId: number): boolean {
  return calendarSessionId === sessionId && useCalendarStore.getState().activeUserId === userId;
}

export function beginCalendarSession(userId: UserId): void {
  calendarSessionId += 1;
  loadBillsRequestId += 1;
  loadPaymentsRequestId += 1;
  useCalendarStore.getState().beginSession(userId);
}

export function beginBillsLoadRequest(userId: UserId): BillsLoadRequest {
  const requestId = ++loadBillsRequestId;
  const sessionId = calendarSessionId;

  useCalendarStore.getState().setIsLoading(true);

  return { requestId, sessionId, userId };
}

export function stopBillsLoading(requestId: number): void {
  if (loadBillsRequestId === requestId) {
    useCalendarStore.getState().setIsLoading(false);
  }
}

export function beginPaymentsLoadRequest(): PaymentsLoadRequest {
  return {
    requestId: ++loadPaymentsRequestId,
    requestedMonth: useCalendarStore.getState().currentMonth,
    sessionId: calendarSessionId,
    userId: useCalendarStore.getState().activeUserId,
  };
}

export function isCurrentBillsRequest(request: BillsLoadRequest): boolean {
  return (
    loadBillsRequestId === request.requestId &&
    useCalendarStore.getState().activeUserId === request.userId &&
    calendarSessionId === request.sessionId
  );
}

export function isCurrentPaymentsRequest(request: PaymentsLoadRequest): boolean {
  return (
    request.userId != null &&
    loadPaymentsRequestId === request.requestId &&
    useCalendarStore.getState().activeUserId === request.userId &&
    useCalendarStore.getState().currentMonth.getTime() === request.requestedMonth.getTime() &&
    calendarSessionId === request.sessionId
  );
}

export function captureCalendarMutationSession(userId: UserId): CalendarMutationSession {
  return { userId, sessionId: calendarSessionId };
}

export function applyMutationIfSessionIsActive(
  session: CalendarMutationSession,
  apply: () => void
): boolean {
  if (!isActiveCalendarSession(session.userId, session.sessionId)) {
    return false;
  }

  apply();
  return true;
}
