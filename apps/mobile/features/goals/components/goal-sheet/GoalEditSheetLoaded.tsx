import { useTranslation } from "@/shared/hooks";
import { parseOptionalIsoDate } from "@/shared/lib";
import type { Goal } from "../../schema";
import { GoalSheetActionButton } from "./GoalSheetActionButton";
import { GoalSheetForm } from "./GoalSheetForm";
import { useGoalEditActions } from "./useGoalEditActions";
import { useGoalSheetForm } from "./useGoalSheetForm";

type GoalEditSheetLoadedProps = {
  readonly goal: Goal;
  readonly goalId: string;
};

export function GoalEditSheetLoaded({ goal, goalId }: GoalEditSheetLoadedProps) {
  const { t } = useTranslation();
  const form = useGoalSheetForm({
    initialDigits: String(goal.targetAmount),
    initialGoalType: goal.type,
    initialInterestRate: goal.interestRatePercent != null ? String(goal.interestRatePercent) : "",
    initialName: goal.name,
    initialTargetDate: parseOptionalIsoDate(goal.targetDate),
  });
  const editActions = useGoalEditActions(goal, goalId, form);

  return (
    <GoalSheetForm title={t("goals.edit.title")} form={form}>
      <GoalSheetActionButton
        label={t("goals.edit.saveChanges")}
        busy={editActions.isSaving}
        disabled={editActions.isSaving || editActions.userId == null}
        onPress={editActions.onSave}
      />
      <GoalSheetActionButton
        label={t("goals.edit.deleteGoal")}
        busy={editActions.isDeleting}
        disabled={editActions.isDeleting || editActions.userId == null}
        onPress={editActions.onDelete}
        variant="destructive"
      />
    </GoalSheetForm>
  );
}
