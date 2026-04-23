/* eslint-disable no-restricted-imports */

import { insertUserCategory } from "@/features/categories/lib/repository";
import type { MutationCommandByKind, MutationHandlerSubset } from "./common";
import { completeCommand, queueSyncChange } from "./common";

type CategorySaveCommand = MutationCommandByKind<"category.save">;

const applyCategorySave = (
  db: Parameters<MutationHandlerSubset<"category.save">["category.save"]>[0],
  command: CategorySaveCommand
) => {
  insertUserCategory(db, command.row);
  queueSyncChange(db, {
    tableName: "userCategories",
    rowId: command.row.id,
    operation: "insert",
    createdAt: command.row.updatedAt,
  });
  return completeCommand(command.afterCommit);
};

export const categoryHandlers: MutationHandlerSubset<"category.save"> = {
  "category.save": applyCategorySave,
};
