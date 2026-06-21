import { useRouter } from "expo-router";
import { AppAuroraBackground, IconActionButton, SolidScreenHeader } from "@/shared/components";
import { Pencil } from "@/shared/components/icons";
import { View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { GoalDetailContent } from "./goal-detail/GoalDetailContent";
import { useGoalDetail } from "./goal-detail/useGoalDetail";

export function GoalDetailScreen() {
  const { back } = useRouter();
  const isDark = useColorScheme() === "dark";
  const primary = useThemeColor("primary");
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
          <IconActionButton
            accessibilityLabel={t("common.edit")}
            icon={<Pencil size={20} color={primary} />}
            onPress={detail.onEditGoal}
            size="size-11"
            tone="surface"
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
