/* eslint-disable no-restricted-imports */

import {
  clearCategoryColorOverride,
  clearCategoryIconOverride,
  insertUserCategory,
  upsertCategoryColorOverride,
  upsertCategoryIconOverride,
} from "@/infrastructure/local-ledger/category-storage";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand } from "./common";

type CategoryMutationKind =
  | "category.save"
  | "categoryIconOverride.save"
  | "categoryIconOverride.clear"
  | "categoryColorOverride.save"
  | "categoryColorOverride.clear";
type CategorySaveCommand = MutationCommandByKind<"category.save">;
type CategoryIconOverrideSaveCommand = MutationCommandByKind<"categoryIconOverride.save">;
type CategoryIconOverrideClearCommand = MutationCommandByKind<"categoryIconOverride.clear">;
type CategoryColorOverrideSaveCommand = MutationCommandByKind<"categoryColorOverride.save">;
type CategoryColorOverrideClearCommand = MutationCommandByKind<"categoryColorOverride.clear">;

const applyCategorySave = (
  db: Parameters<MutationHandlerSubset<CategoryMutationKind>["category.save"]>[0],
  command: CategorySaveCommand
) => {
  insertUserCategory(db, command.row);
  return completeCommand(command.afterCommit);
};

const applyCategoryIconOverrideSave = (
  db: Parameters<MutationHandlerSubset<CategoryMutationKind>["categoryIconOverride.save"]>[0],
  command: CategoryIconOverrideSaveCommand
) => {
  upsertCategoryIconOverride(db, command.row);
  return completeCommand(command.afterCommit);
};

const applyCategoryIconOverrideClear = (
  db: Parameters<MutationHandlerSubset<CategoryMutationKind>["categoryIconOverride.clear"]>[0],
  command: CategoryIconOverrideClearCommand
) => {
  clearCategoryIconOverride(db, {
    userId: command.userId,
    categoryId: command.categoryId,
    now: command.now,
  });
  return completeCommand(command.afterCommit);
};

const applyCategoryColorOverrideSave = (
  db: Parameters<MutationHandlerSubset<CategoryMutationKind>["categoryColorOverride.save"]>[0],
  command: CategoryColorOverrideSaveCommand
) => {
  upsertCategoryColorOverride(db, command.row);
  return completeCommand(command.afterCommit);
};

const applyCategoryColorOverrideClear = (
  db: Parameters<MutationHandlerSubset<CategoryMutationKind>["categoryColorOverride.clear"]>[0],
  command: CategoryColorOverrideClearCommand
) => {
  clearCategoryColorOverride(db, {
    userId: command.userId,
    categoryId: command.categoryId,
    now: command.now,
  });
  return completeCommand(command.afterCommit);
};

export const categoryHandlers: MutationHandlerSubset<CategoryMutationKind> = {
  "category.save": applyCategorySave,
  "categoryIconOverride.save": applyCategoryIconOverrideSave,
  "categoryIconOverride.clear": applyCategoryIconOverrideClear,
  "categoryColorOverride.save": applyCategoryColorOverrideSave,
  "categoryColorOverride.clear": applyCategoryColorOverrideClear,
};
