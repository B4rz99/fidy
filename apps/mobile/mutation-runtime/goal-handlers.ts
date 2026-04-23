/* eslint-disable no-restricted-imports */

import {
  insertContribution,
  insertGoal,
  softDeleteContribution,
  softDeleteGoal,
  updateGoal,
} from "@/features/goals/lib/repository";
import { assertIsoDateTime } from "@/shared/types/assertions";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand, queueSyncChange } from "./common";

type GoalSaveCommand = MutationCommandByKind<"goal.save">;
type GoalUpdateCommand = MutationCommandByKind<"goal.update">;
type GoalDeleteCommand = MutationCommandByKind<"goal.delete">;
type GoalContributionSaveCommand = MutationCommandByKind<"goalContribution.save">;
type GoalContributionDeleteCommand = MutationCommandByKind<"goalContribution.delete">;

const applyGoalSave = (
  db: Parameters<MutationHandlerSubset<"goal.save">["goal.save"]>[0],
  command: GoalSaveCommand
) => {
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

const applyGoalUpdate = (
  db: Parameters<MutationHandlerSubset<"goal.update">["goal.update"]>[0],
  command: GoalUpdateCommand
) => {
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

const applyGoalDelete = (
  db: Parameters<MutationHandlerSubset<"goal.delete">["goal.delete"]>[0],
  command: GoalDeleteCommand
) => {
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
  db: Parameters<MutationHandlerSubset<"goalContribution.save">["goalContribution.save"]>[0],
  command: GoalContributionSaveCommand
) => {
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
  db: Parameters<MutationHandlerSubset<"goalContribution.delete">["goalContribution.delete"]>[0],
  command: GoalContributionDeleteCommand
) => {
  softDeleteContribution(db, command.contributionId, command.now);
  queueSyncChange(db, {
    tableName: "goalContributions",
    rowId: command.contributionId,
    operation: "delete",
    createdAt: command.now,
  });
  return completeCommand(command.afterCommit);
};

export const goalHandlers: MutationHandlerSubset<
  "goal.save" | "goal.update" | "goal.delete" | "goalContribution.save" | "goalContribution.delete"
> = {
  "goal.save": applyGoalSave,
  "goal.update": applyGoalUpdate,
  "goal.delete": applyGoalDelete,
  "goalContribution.save": applyGoalContributionSave,
  "goalContribution.delete": applyGoalContributionDelete,
};
