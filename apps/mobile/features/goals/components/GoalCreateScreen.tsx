import { useRouter } from "expo-router";
import { useTranslation } from "@/shared/hooks";
import { GoalFormActionButton } from "./goal-form/GoalFormActionButton";
import { GoalForm } from "./goal-form/GoalForm";
import { useGoalCreateActions } from "./goal-form/useGoalCreateActions";
import { useGoalForm } from "./goal-form/useGoalForm";

export function GoalCreateScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const form = useGoalForm({
    initialGoalType: "savings",
    initialNumpadTarget: "amount",
  });
  const createActions = useGoalCreateActions(form);

  return (
    <GoalForm form={form} headerTitle={t("goals.create.title")} onBack={back} showGoalTypeToggle>
      <GoalFormActionButton
        label={t("goals.create.title")}
        busy={createActions.isCreating}
        disabled={createActions.isCreating || createActions.userId == null}
        onPress={createActions.onCreate}
      />
    </GoalForm>
  );
}
