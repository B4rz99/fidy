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
  type MutationCommandApplier,
  type MutationDb,
  type MutationOutcome,
  toSyncEntry,
  type WriteThroughMutationModule,
} from "@/shared/mutations/write-through";

import { assertIsoDateTime } from "@/shared/types/assertions";

function applyTransactionSave(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "transaction.save" }>
): CommandEffectResult {
  if (command.mode === "insert") {
    insertTransaction(db, command.row);
  } else {
    upsertTransaction(db, command.row);
  }

  enqueueSync(
    db,
    toSyncEntry(
      "transactions",
      command.row.id,
      command.mode === "insert" ? "insert" : "update",
      command.row.updatedAt
    )
  );

  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyTransactionDelete(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "transaction.delete" }>
): CommandEffectResult {
  softDeleteTransaction(db, command.transactionId, command.now);
  enqueueSync(db, toSyncEntry("transactions", command.transactionId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalSave(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "goal.save" }>
): CommandEffectResult {
  assertIsoDateTime(command.row.updatedAt);
  insertGoal(db, command.row);
  enqueueSync(db, toSyncEntry("goals", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalUpdate(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "goal.update" }>
): CommandEffectResult {
  updateGoal(db, command.goalId, command.data, command.now);
  enqueueSync(db, toSyncEntry("goals", command.goalId, "update", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalDelete(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "goal.delete" }>
): CommandEffectResult {
  softDeleteGoal(db, command.goalId, command.now);
  enqueueSync(db, toSyncEntry("goals", command.goalId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalContributionSave(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "goalContribution.save" }>
): CommandEffectResult {
  assertIsoDateTime(command.row.updatedAt);
  insertContribution(db, command.row);
  enqueueSync(
    db,
    toSyncEntry("goalContributions", command.row.id, "insert", command.row.updatedAt)
  );
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalContributionDelete(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "goalContribution.delete" }>
): CommandEffectResult {
  softDeleteContribution(db, command.contributionId, command.now);
  enqueueSync(db, toSyncEntry("goalContributions", command.contributionId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetSave(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "budget.save" }>
): CommandEffectResult {
  insertBudget(db, command.row);
  enqueueSync(db, toSyncEntry("budgets", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetUpdate(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "budget.update" }>
): CommandEffectResult {
  updateBudgetAmount(db, command.budgetId, command.amount, command.now);
  enqueueSync(db, toSyncEntry("budgets", command.budgetId, "update", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetDelete(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "budget.delete" }>
): CommandEffectResult {
  softDeleteBudget(db, command.budgetId, command.now);
  enqueueSync(db, toSyncEntry("budgets", command.budgetId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetCopy(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "budget.copy" }>
): CommandEffectResult {
  const copiedIds = copyBudgetsToMonth(
    db,
    command.userId,
    command.sourceMonth,
    command.targetMonth,
    command.now,
    createBudgetCopyId
  );

  copiedIds.forEach((id) => {
    enqueueSync(db, toSyncEntry("budgets", id, "insert", command.now));
  });

  return { didMutate: copiedIds.length > 0, effects: command.afterCommit ?? [] };
}

function applyNotificationInsert(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "notification.insert" }>
): CommandEffectResult {
  const result = insertNotification(db, command.row);
  if (result.changes === 0) {
    return { didMutate: false, effects: command.afterCommit ?? [] };
  }

  enqueueSync(db, toSyncEntry("notifications", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyNotificationClearAll(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "notification.clearAll" }>
): CommandEffectResult {
  const allIds = getAllNotificationIds(db, command.userId);
  softDeleteAllNotifications(db, command.userId, command.now);
  allIds.forEach((id) => {
    enqueueSync(db, toSyncEntry("notifications", id, "delete", command.now));
  });
  return { didMutate: allIds.length > 0, effects: command.afterCommit ?? [] };
}

function applyCategorySave(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "category.save" }>
): CommandEffectResult {
  insertUserCategory(db, command.row);
  enqueueSync(db, toSyncEntry("userCategories", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillSave(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.save" }>
): CommandEffectResult {
  insertBill(db, command.row);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillUpdate(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.update" }>
): CommandEffectResult {
  updateBill(db, command.billId, command.fields, command.now);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillDelete(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.delete" }>
): CommandEffectResult {
  deleteBill(db, command.billId);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillMarkPaid(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.markPaid" }>
): CommandEffectResult {
  insertTransaction(db, command.transactionRow);
  enqueueSync(
    db,
    toSyncEntry(
      "transactions",
      command.transactionRow.id,
      "insert",
      command.transactionRow.updatedAt
    )
  );
  insertBillPayment(db, command.paymentRow);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillUnmarkPaid(
  db: MutationDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.unmarkPaid" }>
): CommandEffectResult {
  if (command.transactionId) {
    softDeleteTransaction(db, command.transactionId, command.now);
    enqueueSync(db, toSyncEntry("transactions", command.transactionId, "delete", command.now));
  }

  deleteBillPayment(db, command.billId, command.dueDate);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

const applyCommand: MutationCommandApplier = (db, command) => {
  switch (command.kind) {
    case "transaction.save":
      return applyTransactionSave(db, command);
    case "transaction.delete":
      return applyTransactionDelete(db, command);
    case "goal.save":
      return applyGoalSave(db, command);
    case "goal.update":
      return applyGoalUpdate(db, command);
    case "goal.delete":
      return applyGoalDelete(db, command);
    case "goalContribution.save":
      return applyGoalContributionSave(db, command);
    case "goalContribution.delete":
      return applyGoalContributionDelete(db, command);
    case "budget.save":
      return applyBudgetSave(db, command);
    case "budget.update":
      return applyBudgetUpdate(db, command);
    case "budget.delete":
      return applyBudgetDelete(db, command);
    case "budget.copy":
      return applyBudgetCopy(db, command);
    case "notification.insert":
      return applyNotificationInsert(db, command);
    case "notification.clearAll":
      return applyNotificationClearAll(db, command);
    case "category.save":
      return applyCategorySave(db, command);
    case "calendar.bill.save":
      return applyCalendarBillSave(db, command);
    case "calendar.bill.update":
      return applyCalendarBillUpdate(db, command);
    case "calendar.bill.delete":
      return applyCalendarBillDelete(db, command);
    case "calendar.bill.markPaid":
      return applyCalendarBillMarkPaid(db, command);
    case "calendar.bill.unmarkPaid":
      return applyCalendarBillUnmarkPaid(db, command);
  }

  const exhaustiveCheck: never = command;
  return exhaustiveCheck;
};

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
