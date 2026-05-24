import { Stack } from "expo-router";
import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./goal-detail/GoalDetail.styles";
import { GoalDetailContent } from "./goal-detail/GoalDetailContent";
import { useGoalDetail } from "./goal-detail/useGoalDetail";

export function GoalDetailScreen() {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
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
            <Pressable onPress={detail.onEditGoal} hitSlop={8}>
              <Text style={[styles.editHeaderButton, { color: accentGreen }]}>
                {t("common.edit")}
              </Text>
            </Pressable>
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
