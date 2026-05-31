import { useTranslation } from "@/shared/hooks";
import { parseOptionalIsoDate } from "@/shared/lib";
import type { Goal } from "../../schema";
import { GoalFormActionButton } from "./GoalFormActionButton";
import { GoalForm } from "./GoalForm";
import { useGoalEditActions } from "./useGoalEditActions";
import { useGoalForm } from "./useGoalForm";

type GoalEditScreenLoadedProps = {
  readonly goal: Goal;
  readonly goalId: string;
};

export function GoalEditScreenLoaded({ goal, goalId }: GoalEditScreenLoadedProps) {
  const { t } = useTranslation();
  const form = useGoalForm({
    initialDigits: String(goal.targetAmount),
    initialGoalType: goal.type,
    initialInterestRate: goal.interestRatePercent != null ? String(goal.interestRatePercent) : "",
    initialName: goal.name,
    initialTargetDate: parseOptionalIsoDate(goal.targetDate),
  });
  const editActions = useGoalEditActions(goal, goalId, form);

  return (
    <GoalForm form={form}>
      <GoalFormActionButton
        label={t("goals.edit.saveChanges")}
        busy={editActions.isSaving}
        disabled={editActions.isSaving || editActions.userId == null}
        onPress={editActions.onSave}
      />
      <GoalFormActionButton
        label={t("goals.edit.deleteGoal")}
        busy={editActions.isDeleting}
        disabled={editActions.isDeleting || editActions.userId == null}
        onPress={editActions.onDelete}
        variant="destructive"
      />
    </GoalForm>
  );
}
