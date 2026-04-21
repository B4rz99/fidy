/* eslint-disable no-restricted-imports */

import {
  copyBudgetsToMonth,
  insertBudget,
  type BudgetRow as RepoBudgetRow,
  softDeleteBudget,
  updateBudgetAmount,
} from "@/features/budget/lib/repository";
import {
  deleteBill,
  deleteBillPayment,
  insertBill,
  insertBillPayment,
  type BillPaymentRow as RepoBillPaymentRow,
  type BillRow as RepoBillRow,
  updateBill,
} from "@/features/calendar/lib/repository";
import {
  insertUserCategory,
  type UserCategoryRow as RepoUserCategoryRow,
} from "@/features/categories/lib/repository";
import {
  insertContribution,
  insertGoal,
  type GoalContributionRow as RepoGoalContributionRow,
  type GoalRow as RepoGoalRow,
  softDeleteContribution,
  softDeleteGoal,
  updateGoal,
} from "@/features/goals/lib/repository";
import {
  getAllNotificationIds,
  insertNotification,
  type NotificationRow as RepoNotificationRow,
  softDeleteAllNotifications,
} from "@/features/notifications/repository";
import {
  insertTransaction,
  type TransactionRow as RepoTransactionRow,
  softDeleteTransaction,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import { type AnyDb, enqueueSync } from "@/shared/db";
import {
  type CommandEffectResult,
  createBudgetCopyId,
  createGenericWriteThroughMutationModule,
  getMutationPolicy,
  type MutationCommand,
  type MutationDb,
  type MutationEffect,
  type MutationOutcome,
  toSyncEntry,
  type WriteThroughMutationModule,
} from "@/shared/mutations/write-through";

import { assertIsoDateTime } from "@/shared/types/assertions";

type MutationKind = MutationCommand["kind"];
type MutationCommandByKind = {
  [Kind in MutationKind]: Extract<MutationCommand, { kind: Kind }>;
};
type MutationHandler<Kind extends MutationKind> = (
  db: MutationDb,
  command: MutationCommandByKind[Kind]
) => CommandEffectResult;
type MutationHandlerRegistry = {
  [Kind in MutationKind]: MutationHandler<Kind>;
};
type MutationHandlerSubset<Kind extends MutationKind> = Pick<MutationHandlerRegistry, Kind>;
type SyncChange = {
  tableName: Parameters<typeof toSyncEntry>[0];
  rowId: Parameters<typeof toSyncEntry>[1];
  operation: Parameters<typeof toSyncEntry>[2];
  createdAt: Parameters<typeof toSyncEntry>[3];
};
type TransactionSaveCommand = MutationCommandByKind["transaction.save"];
type TransactionDeleteCommand = MutationCommandByKind["transaction.delete"];
type GoalSaveCommand = MutationCommandByKind["goal.save"];
type GoalUpdateCommand = MutationCommandByKind["goal.update"];
type GoalDeleteCommand = MutationCommandByKind["goal.delete"];
type GoalContributionSaveCommand = MutationCommandByKind["goalContribution.save"];
type GoalContributionDeleteCommand = MutationCommandByKind["goalContribution.delete"];
type BudgetSaveCommand = MutationCommandByKind["budget.save"];
type BudgetUpdateCommand = MutationCommandByKind["budget.update"];
type BudgetDeleteCommand = MutationCommandByKind["budget.delete"];
type BudgetCopyCommand = MutationCommandByKind["budget.copy"];
type NotificationInsertCommand = MutationCommandByKind["notification.insert"];
type NotificationClearAllCommand = MutationCommandByKind["notification.clearAll"];
type CategorySaveCommand = MutationCommandByKind["category.save"];
type CalendarBillSaveCommand = MutationCommandByKind["calendar.bill.save"];
type CalendarBillUpdateCommand = MutationCommandByKind["calendar.bill.update"];
type CalendarBillDeleteCommand = MutationCommandByKind["calendar.bill.delete"];
type CalendarBillMarkPaidCommand = MutationCommandByKind["calendar.bill.markPaid"];
type CalendarBillUnmarkPaidCommand = MutationCommandByKind["calendar.bill.unmarkPaid"];

const completeCommand = (
  afterCommit: readonly MutationEffect[] | undefined,
  didMutate = true
): CommandEffectResult => ({ didMutate, effects: afterCommit ?? [] });

const queueSyncChange = (db: MutationDb, change: SyncChange): void => {
  enqueueSync(db, toSyncEntry(change.tableName, change.rowId, change.operation, change.createdAt));
};

const applyTransactionSave = (
  db: MutationDb,
  command: TransactionSaveCommand
): CommandEffectResult => {
  const persistTransaction = command.mode === "insert" ? insertTransaction : upsertTransaction;
  const operation = command.mode === "insert" ? "insert" : "update";

  persistTransaction(db, command.row);
  queueSyncChange(db, {
    tableName: "transactions",
    rowId: command.row.id,
    operation,
    createdAt: command.row.updatedAt,
  });

  return completeCommand(command.afterCommit);
};

const applyTransactionDelete = (
  db: MutationDb,
  command: TransactionDeleteCommand
): CommandEffectResult => {
  softDeleteTransaction(db, command.transactionId, command.now);
  queueSyncChange(db, {
    tableName: "transactions",
    rowId: command.transactionId,
    operation: "delete",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyGoalSave = (db: MutationDb, command: GoalSaveCommand): CommandEffectResult => {
  assertIsoDateTime(command.row.updatedAt);
  insertGoal(db, command.row);
  queueSyncChange(db, {
    tableName: "goals",
    rowId: command.row.id,
    operation: "insert",
    createdAt: command.row.updatedAt,
  });
  return completeCommand(command.afterCommit);
};

const applyGoalUpdate = (db: MutationDb, command: GoalUpdateCommand): CommandEffectResult => {
  updateGoal({
    db,
    id: command.goalId,
    data: command.data,
    now: command.now,
  });
  queueSyncChange(db, {
    tableName: "goals",
    rowId: command.goalId,
    operation: "update",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyGoalDelete = (db: MutationDb, command: GoalDeleteCommand): CommandEffectResult => {
  softDeleteGoal(db, command.goalId, command.now);
  queueSyncChange(db, {
    tableName: "goals",
    rowId: command.goalId,
    operation: "delete",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyGoalContributionSave = (
  db: MutationDb,
  command: GoalContributionSaveCommand
): CommandEffectResult => {
  assertIsoDateTime(command.row.updatedAt);
  insertContribution(db, command.row);
  queueSyncChange(db, {
    tableName: "goalContributions",
    rowId: command.row.id,
    operation: "insert",
    createdAt: command.row.updatedAt,
  });
  return completeCommand(command.afterCommit);
};

const applyGoalContributionDelete = (
  db: MutationDb,
  command: GoalContributionDeleteCommand
): CommandEffectResult => {
  softDeleteContribution(db, command.contributionId, command.now);
  queueSyncChange(db, {
    tableName: "goalContributions",
    rowId: command.contributionId,
    operation: "delete",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyBudgetSave = (db: MutationDb, command: BudgetSaveCommand): CommandEffectResult => {
  insertBudget(db, command.row);
  queueSyncChange(db, {
    tableName: "budgets",
    rowId: command.row.id,
    operation: "insert",
    createdAt: command.row.updatedAt,
  });
  return completeCommand(command.afterCommit);
};

const applyBudgetUpdate = (db: MutationDb, command: BudgetUpdateCommand): CommandEffectResult => {
  updateBudgetAmount({
    db,
    id: command.budgetId,
    amount: command.amount,
    now: command.now,
  });
  queueSyncChange(db, {
    tableName: "budgets",
    rowId: command.budgetId,
    operation: "update",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyBudgetDelete = (db: MutationDb, command: BudgetDeleteCommand): CommandEffectResult => {
  softDeleteBudget(db, command.budgetId, command.now);
  queueSyncChange(db, {
    tableName: "budgets",
    rowId: command.budgetId,
    operation: "delete",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyBudgetCopy = (db: MutationDb, command: BudgetCopyCommand): CommandEffectResult => {
  const copiedIds = copyBudgetsToMonth(
    db,
    command.userId,
    command.sourceMonth,
    command.targetMonth,
    command.now,
    createBudgetCopyId
  );

  copiedIds.forEach((id) => {
    queueSyncChange(db, {
      tableName: "budgets",
      rowId: id,
      operation: "insert",
      createdAt: command.now,
    });
  });

  return completeCommand(command.afterCommit, copiedIds.length > 0);
};

const applyNotificationInsert = (
  db: MutationDb,
  command: NotificationInsertCommand
): CommandEffectResult => {
  const result = insertNotification(db, command.row);
  if (result.changes === 0) {
    return completeCommand(command.afterCommit, false);
  }

  queueSyncChange(db, {
    tableName: "notifications",
    rowId: command.row.id,
    operation: "insert",
    createdAt: command.row.updatedAt,
  });
  return completeCommand(command.afterCommit);
};

const applyNotificationClearAll = (
  db: MutationDb,
  command: NotificationClearAllCommand
): CommandEffectResult => {
  const allIds = getAllNotificationIds(db, command.userId);
  softDeleteAllNotifications(db, command.userId, command.now);
  allIds.forEach((id) => {
    queueSyncChange(db, {
      tableName: "notifications",
      rowId: id,
      operation: "delete",
      createdAt: command.now,
    });
  });
  return completeCommand(command.afterCommit, allIds.length > 0);
};

const applyCategorySave = (db: MutationDb, command: CategorySaveCommand): CommandEffectResult => {
  insertUserCategory(db, command.row);
  queueSyncChange(db, {
    tableName: "userCategories",
    rowId: command.row.id,
    operation: "insert",
    createdAt: command.row.updatedAt,
  });
  return completeCommand(command.afterCommit);
};

const applyCalendarBillSave = (
  db: MutationDb,
  command: CalendarBillSaveCommand
): CommandEffectResult => {
  insertBill(db, command.row);
  return completeCommand(command.afterCommit);
};

const applyCalendarBillUpdate = (
  db: MutationDb,
  command: CalendarBillUpdateCommand
): CommandEffectResult => {
  updateBill(db, {
    id: command.billId,
    fields: command.fields,
    now: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyCalendarBillDelete = (
  db: MutationDb,
  command: CalendarBillDeleteCommand
): CommandEffectResult => {
  deleteBill(db, command.billId);
  return completeCommand(command.afterCommit);
};

const applyCalendarBillMarkPaid = (
  db: MutationDb,
  command: CalendarBillMarkPaidCommand
): CommandEffectResult => {
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
  db: MutationDb,
  command: CalendarBillUnmarkPaidCommand
): CommandEffectResult => {
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

const transactionHandlers: MutationHandlerSubset<"transaction.save" | "transaction.delete"> = {
  "transaction.save": applyTransactionSave,
  "transaction.delete": applyTransactionDelete,
};

const goalHandlers: MutationHandlerSubset<
  "goal.save" | "goal.update" | "goal.delete" | "goalContribution.save" | "goalContribution.delete"
> = {
  "goal.save": applyGoalSave,
  "goal.update": applyGoalUpdate,
  "goal.delete": applyGoalDelete,
  "goalContribution.save": applyGoalContributionSave,
  "goalContribution.delete": applyGoalContributionDelete,
};

const budgetHandlers: MutationHandlerSubset<
  "budget.save" | "budget.update" | "budget.delete" | "budget.copy"
> = {
  "budget.save": applyBudgetSave,
  "budget.update": applyBudgetUpdate,
  "budget.delete": applyBudgetDelete,
  "budget.copy": applyBudgetCopy,
};

const notificationHandlers: MutationHandlerSubset<"notification.insert" | "notification.clearAll"> =
  {
    "notification.insert": applyNotificationInsert,
    "notification.clearAll": applyNotificationClearAll,
  };

const categoryHandlers: MutationHandlerSubset<"category.save"> = {
  "category.save": applyCategorySave,
};

const calendarHandlers: MutationHandlerSubset<
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

const mutationHandlers: MutationHandlerRegistry = {
  ...transactionHandlers,
  ...goalHandlers,
  ...budgetHandlers,
  ...notificationHandlers,
  ...categoryHandlers,
  ...calendarHandlers,
};

const applyCommand = (db: MutationDb, command: MutationCommand): CommandEffectResult =>
  mutationHandlers[command.kind](db, command as never);

export function createWriteThroughMutationModule(db: AnyDb): WriteThroughMutationModule {
  return createGenericWriteThroughMutationModule(db, applyCommand);
}

export {
  getMutationPolicy,
  type MutationOutcome,
  type WriteThroughMutationModule,
  type RepoNotificationRow as NotificationRow,
  type RepoTransactionRow as TransactionRow,
  type RepoUserCategoryRow as UserCategoryRow,
  type RepoBudgetRow as BudgetRow,
  type RepoBillRow as BillRow,
  type RepoBillPaymentRow as BillPaymentRow,
  type RepoGoalRow as GoalRow,
  type RepoGoalContributionRow as GoalContributionRow,
};
