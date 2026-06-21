import { useRouter } from "expo-router";
import { AppAuroraBackground, SolidScreenHeader, TextActionButton } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useColorScheme, useTranslation } from "@/shared/hooks";
import { GoalDetailContent } from "./goal-detail/GoalDetailContent";
import { useGoalDetail } from "./goal-detail/useGoalDetail";

export function GoalDetailScreen() {
  const { back } = useRouter();
  const isDark = useColorScheme() === "dark";
  const { t } = useTranslation();
  const detail = useGoalDetail();

  if (detail.goalData == null) {
    return null;
  }

  const { goal, currentAmount, progress, projection } = detail.goalData;

  return (
    <View style={{ flex: 1 }}>
      <AppAuroraBackground isDark={isDark} />
      <SolidScreenHeader
        title={goal.name}
        onBack={back}
        rightAction={
          <TextActionButton
            label={t("common.edit")}
            onPress={detail.onEditGoal}
            hitSlop={8}
            appearance="plain"
          />
        }
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
    </View>
  );
}
