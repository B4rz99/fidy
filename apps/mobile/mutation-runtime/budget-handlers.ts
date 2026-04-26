/* eslint-disable no-restricted-imports */

import {
  copyBudgetsToMonth,
  insertBudget,
  softDeleteBudget,
  updateBudgetAmount,
} from "@/features/budget/lib/repository";
import { createBudgetCopyId } from "@/shared/mutations";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand } from "./common";

type BudgetSaveCommand = MutationCommandByKind<"budget.save">;
type BudgetUpdateCommand = MutationCommandByKind<"budget.update">;
type BudgetDeleteCommand = MutationCommandByKind<"budget.delete">;
type BudgetCopyCommand = MutationCommandByKind<"budget.copy">;

const applyBudgetSave = (
  db: Parameters<MutationHandlerSubset<"budget.save">["budget.save"]>[0],
  command: BudgetSaveCommand
) => {
  insertBudget(db, command.row);
  return completeCommand(command.afterCommit);
};

const applyBudgetUpdate = (
  db: Parameters<MutationHandlerSubset<"budget.update">["budget.update"]>[0],
  command: BudgetUpdateCommand
) => {
  updateBudgetAmount({
    db,
    id: command.budgetId,
    amount: command.amount,
    now: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyBudgetDelete = (
  db: Parameters<MutationHandlerSubset<"budget.delete">["budget.delete"]>[0],
  command: BudgetDeleteCommand
) => {
  softDeleteBudget(db, command.budgetId, command.now);
  return completeCommand(command.afterCommit);
};

const applyBudgetCopy = (
  db: Parameters<MutationHandlerSubset<"budget.copy">["budget.copy"]>[0],
  command: BudgetCopyCommand
) => {
  const copiedIds = copyBudgetsToMonth(
    db,
    command.userId,
    command.sourceMonth,
    command.targetMonth,
    command.now,
    createBudgetCopyId
  );

  return completeCommand(command.afterCommit, copiedIds.length > 0);
};

export const budgetHandlers: MutationHandlerSubset<
  "budget.save" | "budget.update" | "budget.delete" | "budget.copy"
> = {
  "budget.save": applyBudgetSave,
  "budget.update": applyBudgetUpdate,
  "budget.delete": applyBudgetDelete,
  "budget.copy": applyBudgetCopy,
};
