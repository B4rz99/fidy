import { tryGetDb } from "@/shared/db";
import { createBudget, deleteBudget, updateBudget } from "../../store";
import type { CreateBudgetScreenProps } from "./CreateBudget.types";
import { CreateBudgetForm } from "./CreateBudgetForm";

export function AuthenticatedCreateBudgetForm({
  autoSuggestions,
  existingBudget,
  existingCategoryIds,
  headerTitle,
  onDone,
  userId,
}: Omit<CreateBudgetScreenProps, "userId"> & {
  readonly userId: NonNullable<CreateBudgetScreenProps["userId"]>;
}) {
  const db = tryGetDb(userId);

  return (
    <CreateBudgetForm
      key={existingBudget?.id ?? "new"}
      autoSuggestions={autoSuggestions}
      canMutate={db != null}
      existingBudget={existingBudget}
      existingCategoryIds={existingCategoryIds}
      headerTitle={headerTitle}
      onCreateBudget={(categoryId, amount) => {
        const activeDb = tryGetDb(userId);
        if (!activeDb) return Promise.resolve(false);
        return createBudget(activeDb, userId, categoryId, amount);
      }}
      onDeleteBudget={(id) => {
        const activeDb = tryGetDb(userId);
        if (!activeDb) return Promise.resolve(false);
        return deleteBudget(activeDb, userId, id);
      }}
      onDone={onDone}
      onUpdateBudget={(id, categoryId, amount) => {
        const activeDb = tryGetDb(userId);
        if (!activeDb) return Promise.resolve(false);
        return updateBudget({ amount, categoryId, db: activeDb, id, userId });
      }}
    />
  );
}
