import {
  type BudgetRow,
  copyBudgetsToMonth,
  insertBudget,
  softDeleteBudget,
  updateBudgetAmount,
} from "@/features/budget/lib/repository";
import {
  type BillPaymentRow,
  type BillRow,
  deleteBill,
  deleteBillPayment,
  insertBill,
  insertBillPayment,
  updateBill,
} from "@/features/calendar/lib/repository";
import { insertUserCategory, type UserCategoryRow } from "@/features/categories/lib/repository";
import {
  type GoalContributionRow,
  type GoalRow,
  insertContribution,
  insertGoal,
  softDeleteContribution,
  softDeleteGoal,
  updateGoal,
} from "@/features/goals/lib/repository";
import {
  getAllNotificationIds,
  insertNotification,
  type NotificationRow,
  softDeleteAllNotifications,
} from "@/features/notifications/repository";
import {
  insertTransaction,
  softDeleteTransaction,
  type TransactionRow,
  upsertTransaction,
} from "@/features/transactions/lib/repository";
import type { AnyDb, SyncOperation, SyncTableName } from "@/shared/db";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import { generateBudgetId, generateSyncQueueId } from "@/shared/lib";
import type {
  BillId,
  BudgetId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  Month,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

export type MutationEffect = () => void | Promise<void>;

export type MutationOutcome =
  | { success: true; didMutate: boolean }
  | { success: false; error: string };

type TransactionSaveCommand = {
  kind: "transaction.save";
  mode: "insert" | "update";
  row: TransactionRow;
  afterCommit?: readonly MutationEffect[];
};

type TransactionDeleteCommand = {
  kind: "transaction.delete";
  transactionId: TransactionId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type GoalSaveCommand = {
  kind: "goal.save";
  row: GoalRow;
  afterCommit?: readonly MutationEffect[];
};

type GoalUpdateCommand = {
  kind: "goal.update";
  goalId: string;
  data: Partial<
    Pick<
      GoalRow,
      "name" | "targetAmount" | "targetDate" | "interestRatePercent" | "iconName" | "colorHex"
    >
  >;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type GoalDeleteCommand = {
  kind: "goal.delete";
  goalId: string;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type GoalContributionSaveCommand = {
  kind: "goalContribution.save";
  row: GoalContributionRow;
  afterCommit?: readonly MutationEffect[];
};

type GoalContributionDeleteCommand = {
  kind: "goalContribution.delete";
  contributionId: string;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type BudgetSaveCommand = {
  kind: "budget.save";
  row: BudgetRow;
  afterCommit?: readonly MutationEffect[];
};

type BudgetUpdateCommand = {
  kind: "budget.update";
  budgetId: BudgetId;
  amount: CopAmount;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type BudgetDeleteCommand = {
  kind: "budget.delete";
  budgetId: BudgetId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type BudgetCopyCommand = {
  kind: "budget.copy";
  sourceMonth: Month;
  targetMonth: Month;
  userId: UserId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type NotificationInsertCommand = {
  kind: "notification.insert";
  row: NotificationRow;
  afterCommit?: readonly MutationEffect[];
};

type NotificationClearAllCommand = {
  kind: "notification.clearAll";
  userId: UserId;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type CategorySaveCommand = {
  kind: "category.save";
  row: UserCategoryRow;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillSaveCommand = {
  kind: "calendar.bill.save";
  row: BillRow;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillUpdateCommand = {
  kind: "calendar.bill.update";
  billId: BillId;
  fields: Partial<
    Pick<BillRow, "name" | "amount" | "frequency" | "categoryId" | "startDate" | "isActive">
  >;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillDeleteCommand = {
  kind: "calendar.bill.delete";
  billId: BillId;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillMarkPaidCommand = {
  kind: "calendar.bill.markPaid";
  transactionRow: TransactionRow;
  paymentRow: BillPaymentRow;
  afterCommit?: readonly MutationEffect[];
};

type CalendarBillUnmarkPaidCommand = {
  kind: "calendar.bill.unmarkPaid";
  billId: BillId;
  dueDate: IsoDate;
  transactionId: TransactionId | null;
  now: IsoDateTime;
  afterCommit?: readonly MutationEffect[];
};

export type MutationCommand =
  | TransactionSaveCommand
  | TransactionDeleteCommand
  | GoalSaveCommand
  | GoalUpdateCommand
  | GoalDeleteCommand
  | GoalContributionSaveCommand
  | GoalContributionDeleteCommand
  | BudgetSaveCommand
  | BudgetUpdateCommand
  | BudgetDeleteCommand
  | BudgetCopyCommand
  | NotificationInsertCommand
  | NotificationClearAllCommand
  | CategorySaveCommand
  | CalendarBillSaveCommand
  | CalendarBillUpdateCommand
  | CalendarBillDeleteCommand
  | CalendarBillMarkPaidCommand
  | CalendarBillUnmarkPaidCommand;

export type MutationPolicy = "local-only" | "sync-backed";

const MUTATION_POLICY: Record<MutationCommand["kind"], MutationPolicy> = {
  "transaction.save": "sync-backed",
  "transaction.delete": "sync-backed",
  "goal.save": "sync-backed",
  "goal.update": "sync-backed",
  "goal.delete": "sync-backed",
  "goalContribution.save": "sync-backed",
  "goalContribution.delete": "sync-backed",
  "budget.save": "sync-backed",
  "budget.update": "sync-backed",
  "budget.delete": "sync-backed",
  "budget.copy": "sync-backed",
  "notification.insert": "sync-backed",
  "notification.clearAll": "sync-backed",
  "category.save": "sync-backed",
  "calendar.bill.save": "local-only",
  "calendar.bill.update": "local-only",
  "calendar.bill.delete": "local-only",
  "calendar.bill.markPaid": "sync-backed",
  "calendar.bill.unmarkPaid": "sync-backed",
};

export function getMutationPolicy(kind: MutationCommand["kind"]): MutationPolicy {
  return MUTATION_POLICY[kind];
}

export type WriteThroughMutationModule = {
  commit: (command: MutationCommand) => Promise<MutationOutcome>;
  commitBatch: (commands: readonly MutationCommand[]) => Promise<readonly MutationOutcome[]>;
};

export type CommandEffectResult = {
  didMutate: boolean;
  effects: readonly MutationEffect[];
};

export type MutationCommandApplier = (db: AnyDb, command: MutationCommand) => CommandEffectResult;

export function toSyncEntry(
  tableName: SyncTableName,
  rowId: string,
  operation: SyncOperation,
  createdAt: IsoDateTime
) {
  return {
    id: generateSyncQueueId(),
    tableName,
    rowId,
    operation,
    createdAt,
  };
}

export function createBudgetCopyId(): BudgetId {
  return generateBudgetId();
}

async function runEffects(effects: readonly MutationEffect[]) {
  await effects.reduce(async (previous, effect) => {
    await previous;
    await effect();
  }, Promise.resolve());
}

function applyTransactionSave(db: AnyDb, command: TransactionSaveCommand): CommandEffectResult {
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

function applyTransactionDelete(db: AnyDb, command: TransactionDeleteCommand): CommandEffectResult {
  softDeleteTransaction(db, command.transactionId, command.now);
  enqueueSync(db, toSyncEntry("transactions", command.transactionId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalSave(db: AnyDb, command: GoalSaveCommand): CommandEffectResult {
  insertGoal(db, command.row);
  enqueueSync(
    db,
    toSyncEntry("goals", command.row.id, "insert", command.row.updatedAt as IsoDateTime)
  );
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalUpdate(db: AnyDb, command: GoalUpdateCommand): CommandEffectResult {
  updateGoal(db, command.goalId, command.data, command.now);
  enqueueSync(db, toSyncEntry("goals", command.goalId, "update", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalDelete(db: AnyDb, command: GoalDeleteCommand): CommandEffectResult {
  softDeleteGoal(db, command.goalId, command.now);
  enqueueSync(db, toSyncEntry("goals", command.goalId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalContributionSave(
  db: AnyDb,
  command: GoalContributionSaveCommand
): CommandEffectResult {
  insertContribution(db, command.row);
  enqueueSync(
    db,
    toSyncEntry("goalContributions", command.row.id, "insert", command.row.updatedAt as IsoDateTime)
  );
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyGoalContributionDelete(
  db: AnyDb,
  command: GoalContributionDeleteCommand
): CommandEffectResult {
  softDeleteContribution(db, command.contributionId, command.now);
  enqueueSync(db, toSyncEntry("goalContributions", command.contributionId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetSave(db: AnyDb, command: BudgetSaveCommand): CommandEffectResult {
  insertBudget(db, command.row);
  enqueueSync(db, toSyncEntry("budgets", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetUpdate(db: AnyDb, command: BudgetUpdateCommand): CommandEffectResult {
  updateBudgetAmount(db, command.budgetId, command.amount, command.now);
  enqueueSync(db, toSyncEntry("budgets", command.budgetId, "update", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetDelete(db: AnyDb, command: BudgetDeleteCommand): CommandEffectResult {
  softDeleteBudget(db, command.budgetId, command.now);
  enqueueSync(db, toSyncEntry("budgets", command.budgetId, "delete", command.now));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyBudgetCopy(db: AnyDb, command: BudgetCopyCommand): CommandEffectResult {
  const copiedIds = copyBudgetsToMonth(
    db,
    command.userId,
    command.sourceMonth,
    command.targetMonth,
    command.now,
    () => generateBudgetId()
  );

  copiedIds.forEach((id) => {
    enqueueSync(db, toSyncEntry("budgets", id, "insert", command.now));
  });

  return { didMutate: copiedIds.length > 0, effects: command.afterCommit ?? [] };
}

function applyNotificationInsert(
  db: AnyDb,
  command: NotificationInsertCommand
): CommandEffectResult {
  const result = insertNotification(db, command.row);
  if (result.changes === 0) {
    return { didMutate: false, effects: command.afterCommit ?? [] };
  }

  enqueueSync(db, toSyncEntry("notifications", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyNotificationClearAll(
  db: AnyDb,
  command: NotificationClearAllCommand
): CommandEffectResult {
  const allIds = getAllNotificationIds(db, command.userId);
  softDeleteAllNotifications(db, command.userId, command.now);
  allIds.forEach((id) => {
    enqueueSync(db, toSyncEntry("notifications", id, "delete", command.now));
  });
  return { didMutate: allIds.length > 0, effects: command.afterCommit ?? [] };
}

function applyCategorySave(db: AnyDb, command: CategorySaveCommand): CommandEffectResult {
  insertUserCategory(db, command.row);
  enqueueSync(db, toSyncEntry("userCategories", command.row.id, "insert", command.row.updatedAt));
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillSave(db: AnyDb, command: CalendarBillSaveCommand): CommandEffectResult {
  insertBill(db, command.row);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillUpdate(
  db: AnyDb,
  command: CalendarBillUpdateCommand
): CommandEffectResult {
  updateBill(db, command.billId, command.fields, command.now);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillDelete(
  db: AnyDb,
  command: CalendarBillDeleteCommand
): CommandEffectResult {
  deleteBill(db, command.billId);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCalendarBillMarkPaid(
  db: AnyDb,
  command: CalendarBillMarkPaidCommand
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
  db: AnyDb,
  command: CalendarBillUnmarkPaidCommand
): CommandEffectResult {
  if (command.transactionId) {
    softDeleteTransaction(db, command.transactionId, command.now);
    enqueueSync(db, toSyncEntry("transactions", command.transactionId, "delete", command.now));
  }

  deleteBillPayment(db, command.billId, command.dueDate);
  return { didMutate: true, effects: command.afterCommit ?? [] };
}

function applyCommand(db: AnyDb, command: MutationCommand): CommandEffectResult {
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
}

export function createGenericWriteThroughMutationModule(
  db: AnyDb,
  applyCommand: MutationCommandApplier
): WriteThroughMutationModule {
  return {
    commit: async (command) => {
      try {
        const result = db.transaction((tx) => applyCommand(tx as AnyDb, command));
        await runEffects(result.effects);
        return { success: true as const, didMutate: result.didMutate };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : "Mutation failed",
        };
      }
    },
    commitBatch: async (commands) => {
      try {
        const result = db.transaction((tx) =>
          commands.reduce<{
            outcomes: readonly MutationOutcome[];
            effects: readonly MutationEffect[];
          }>(
            (acc, command) => {
              const next = applyCommand(tx as AnyDb, command);
              return {
                outcomes: [...acc.outcomes, { success: true as const, didMutate: next.didMutate }],
                effects: [...acc.effects, ...next.effects],
              };
            },
            { outcomes: [], effects: [] }
          )
        );
        await runEffects(result.effects);
        return result.outcomes;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Mutation failed";
        return commands.map(() => ({ success: false as const, error: message }));
      }
    },
  };
}

export function createWriteThroughMutationModule(db: AnyDb): WriteThroughMutationModule {
  return createGenericWriteThroughMutationModule(db, applyCommand);
}
