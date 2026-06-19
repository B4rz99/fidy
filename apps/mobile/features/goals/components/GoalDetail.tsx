import { Stack } from "expo-router";
import { TextActionButton } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";
import { GoalDetailContent } from "./goal-detail/GoalDetailContent";
import { useGoalDetail } from "./goal-detail/useGoalDetail";

export function GoalDetailScreen() {
  const { t } = useTranslation();
  const detail = useGoalDetail();

  if (detail.goalData == null) {
    return null;
  }

  const { goal, currentAmount, progress, projection } = detail.goalData;

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: goal.name,
          headerRight: () => (
            <TextActionButton
              label={t("common.edit")}
              onPress={detail.onEditGoal}
              hitSlop={8}
              appearance="plain"
            />
          ),
        }}
      />
      <GoalDetailContent
        activeTab={detail.activeTab}
        celebrationMilestone={detail.celebrationMilestone}
        contributions={detail.contributions}
        currentAmount={currentAmount}
        goalName={goal.name}
        onAddPayment={detail.onAddPayment}
        onAskFidy={detail.onAskFidy}
        onDismissCelebration={detail.onDismissCelebration}
        onTabChange={detail.onTabChange}
        percentComplete={progress.percentComplete}
        projection={projection}
        recommendationText={detail.recommendationText}
        milestones={detail.milestones}
        targetAmount={goal.targetAmount}
      />
    </>
  );
}
