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
import type { AnyDb } from "@/shared/db";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import {
  type CommandEffectResult,
  createBudgetCopyId,
  createGenericWriteThroughMutationModule,
  getMutationPolicy,
  type MutationCommand,
  type MutationCommandApplier,
  type MutationOutcome,
  toSyncEntry,
  type WriteThroughMutationModule,
} from "@/shared/mutations/write-through";
import type { IsoDateTime } from "@/shared/types/branded";

function applyTransactionSave(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "transaction.save" }>
): CommandEffectResult {
  if (command.mode === "insert") {
    insertTransaction(db, command.row as RepoTransactionRow);
  } else {
    upsertTransaction(db, command.row as RepoTransactionRow);
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
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "transaction.delete" }>
): CommandEffectResult {
  softDeleteTransaction(db, command.transactionId, command.now);
  enqueueSync(db, toSyncEntry("transactions", command.transactionId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalSave(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "goal.save" }>
): CommandEffectResult {
  insertGoal(db, command.row as RepoGoalRow);
  enqueueSync(
    db,
    toSyncEntry("goals", command.row.id, "insert", command.row.updatedAt as IsoDateTime)
  );
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalUpdate(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "goal.update" }>
): CommandEffectResult {
  updateGoal(db, command.goalId, command.data, command.now);
  enqueueSync(db, toSyncEntry("goals", command.goalId, "update", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalDelete(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "goal.delete" }>
): CommandEffectResult {
  softDeleteGoal(db, command.goalId, command.now);
  enqueueSync(db, toSyncEntry("goals", command.goalId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalContributionSave(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "goalContribution.save" }>
): CommandEffectResult {
  insertContribution(db, command.row as RepoGoalContributionRow);
  enqueueSync(
    db,
    toSyncEntry("goalContributions", command.row.id, "insert", command.row.updatedAt as IsoDateTime)
  );
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalContributionDelete(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "goalContribution.delete" }>
): CommandEffectResult {
  softDeleteContribution(db, command.contributionId, command.now);
  enqueueSync(db, toSyncEntry("goalContributions", command.contributionId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetSave(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "budget.save" }>
): CommandEffectResult {
  insertBudget(db, command.row as RepoBudgetRow);
  enqueueSync(db, toSyncEntry("budgets", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetUpdate(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "budget.update" }>
): CommandEffectResult {
  updateBudgetAmount(db, command.budgetId, command.amount, command.now);
  enqueueSync(db, toSyncEntry("budgets", command.budgetId, "update", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetDelete(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "budget.delete" }>
): CommandEffectResult {
  softDeleteBudget(db, command.budgetId, command.now);
  enqueueSync(db, toSyncEntry("budgets", command.budgetId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetCopy(
  db: AnyDb,
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
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "notification.insert" }>
): CommandEffectResult {
  const result = insertNotification(db, command.row as RepoNotificationRow);
  if (result.changes === 0) {
    return { didMutate: false, effects: command.afterCommit ?? [] };
  }

  enqueueSync(db, toSyncEntry("notifications", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyNotificationClearAll(
  db: AnyDb,
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
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "category.save" }>
): CommandEffectResult {
  insertUserCategory(db, command.row as RepoUserCategoryRow);
  enqueueSync(db, toSyncEntry("userCategories", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillSave(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.save" }>
): CommandEffectResult {
  insertBill(db, command.row as RepoBillRow);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillUpdate(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.update" }>
): CommandEffectResult {
  updateBill(db, command.billId, command.fields, command.now);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillDelete(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.delete" }>
): CommandEffectResult {
  deleteBill(db, command.billId);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillMarkPaid(
  db: AnyDb,
  command: Extract<MutationCommand, { kind: "calendar.bill.markPaid" }>
): CommandEffectResult {
  insertTransaction(db, command.transactionRow as RepoTransactionRow);
  enqueueSync(
    db,
    toSyncEntry(
      "transactions",
      command.transactionRow.id,
      "insert",
      command.transactionRow.updatedAt
    )
  );
  insertBillPayment(db, command.paymentRow as RepoBillPaymentRow);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillUnmarkPaid(
  db: AnyDb,
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
  type RepoNotificationRow as NotificationRow,
  type RepoTransactionRow as TransactionRow,
  type RepoUserCategoryRow as UserCategoryRow,
  type RepoBudgetRow as BudgetRow,
  type RepoBillRow as BillRow,
  type RepoBillPaymentRow as BillPaymentRow,
  type RepoGoalRow as GoalRow,
  type RepoGoalContributionRow as GoalContributionRow,
};
