import { useTranslation } from "@/shared/hooks";
import { GoalProjectionHint } from "./goal-sheet/GoalProjectionHint";
import { GoalSheetActionButton } from "./goal-sheet/GoalSheetActionButton";
import { GoalSheetForm } from "./goal-sheet/GoalSheetForm";
import { useGoalCreateActions } from "./goal-sheet/useGoalCreateActions";
import { useGoalSheetForm } from "./goal-sheet/useGoalSheetForm";

export function GoalCreateSheet() {
  const { t } = useTranslation();
  const form = useGoalSheetForm({
    initialGoalType: "savings",
    initialNumpadTarget: "amount",
  });
  const createActions = useGoalCreateActions(form);

  return (
    <GoalSheetForm title={t("goals.create.title")} form={form} showGoalTypeToggle>
      <GoalProjectionHint estimatedMonths={createActions.estimatedMonths} />
      <GoalSheetActionButton
        label={t("goals.create.title")}
        busy={createActions.isCreating}
        disabled={createActions.isCreating || createActions.userId == null}
        onPress={createActions.onCreate}
      />
    </GoalSheetForm>
  );
}
