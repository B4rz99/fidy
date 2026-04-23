/* eslint-disable no-restricted-imports */

import {
  deleteBill,
  deleteBillPayment,
  insertBill,
  insertBillPayment,
  updateBill,
} from "@/features/calendar/lib/repository";
import { insertTransaction, softDeleteTransaction } from "@/features/transactions/lib/repository";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand, queueSyncChange } from "./common";

type CalendarBillSaveCommand = MutationCommandByKind<"calendar.bill.save">;
type CalendarBillUpdateCommand = MutationCommandByKind<"calendar.bill.update">;
type CalendarBillDeleteCommand = MutationCommandByKind<"calendar.bill.delete">;
type CalendarBillMarkPaidCommand = MutationCommandByKind<"calendar.bill.markPaid">;
type CalendarBillUnmarkPaidCommand = MutationCommandByKind<"calendar.bill.unmarkPaid">;

const applyCalendarBillSave = (
  db: Parameters<MutationHandlerSubset<"calendar.bill.save">["calendar.bill.save"]>[0],
  command: CalendarBillSaveCommand
) => {
  insertBill(db, command.row);
  return completeCommand(command.afterCommit);
};

const applyCalendarBillUpdate = (
  db: Parameters<MutationHandlerSubset<"calendar.bill.update">["calendar.bill.update"]>[0],
  command: CalendarBillUpdateCommand
) => {
  updateBill(db, {
    id: command.billId,
    fields: command.fields,
    now: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyCalendarBillDelete = (
  db: Parameters<MutationHandlerSubset<"calendar.bill.delete">["calendar.bill.delete"]>[0],
  command: CalendarBillDeleteCommand
) => {
  deleteBill(db, command.billId);
  return completeCommand(command.afterCommit);
};

const applyCalendarBillMarkPaid = (
  db: Parameters<MutationHandlerSubset<"calendar.bill.markPaid">["calendar.bill.markPaid"]>[0],
  command: CalendarBillMarkPaidCommand
) => {
  insertTransaction(db, command.transactionRow);
  queueSyncChange(db, {
    tableName: "transactions",
    rowId: command.transactionRow.id,
    operation: "insert",
    createdAt: command.transactionRow.updatedAt,
  });
  insertBillPayment(db, command.paymentRow);
  return completeCommand(command.afterCommit);
};

const applyCalendarBillUnmarkPaid = (
  db: Parameters<MutationHandlerSubset<"calendar.bill.unmarkPaid">["calendar.bill.unmarkPaid"]>[0],
  command: CalendarBillUnmarkPaidCommand
) => {
  if (command.transactionId) {
    softDeleteTransaction(db, command.transactionId, command.now);
    queueSyncChange(db, {
      tableName: "transactions",
      rowId: command.transactionId,
      operation: "delete",
      createdAt: command.now,
    });
  }

  deleteBillPayment(db, command.billId, command.dueDate);
  return completeCommand(command.afterCommit);
};

export const calendarHandlers: MutationHandlerSubset<
  | "calendar.bill.save"
  | "calendar.bill.update"
  | "calendar.bill.delete"
  | "calendar.bill.markPaid"
  | "calendar.bill.unmarkPaid"
> = {
  "calendar.bill.save": applyCalendarBillSave,
  "calendar.bill.update": applyCalendarBillUpdate,
  "calendar.bill.delete": applyCalendarBillDelete,
  "calendar.bill.markPaid": applyCalendarBillMarkPaid,
  "calendar.bill.unmarkPaid": applyCalendarBillUnmarkPaid,
};
