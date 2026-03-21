import { useRouter } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import { useGoalStore } from "../store";

export const GoalSmartCard = memo(function GoalSmartCard() {
  const { push } = useRouter();
  const { t } = useTranslation();
  const goals = useGoalStore((s) => s.goals);
  const accentGreen = useThemeColor("accentGreen");

  // Find best goal to display: highest progress % among active (non-complete) goals
  // Fallback: most recently created
  const displayData = useMemo(() => {
    const activeGoals = goals.filter((g) => !g.progress.isComplete);
    if (activeGoals.length === 0) return null;

    const sorted = [...activeGoals].sort(
      (a, b) => b.progress.percentComplete - a.progress.percentComplete
    );
    return {
      topGoal: sorted[0],
      moreCount: activeGoals.length - 1,
    };
  }, [goals]);

  const handlePress = useCallback(() => {
    if (displayData) {
      useGoalStore.getState().selectGoal(displayData.topGoal.goal.id);
      push("/goal-detail" as never);
    }
  }, [displayData, push]);

  if (!displayData) return null;

  const { topGoal, moreCount } = displayData;
  const progressWidth = Math.min(topGoal.progress.percentComplete, 100);

  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: `${accentGreen}15`, // 15% opacity
        borderRadius: 16,
        padding: 16,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 14,
            color: accentGreen,
          }}
        >
          {topGoal.goal.name}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 14,
            color: accentGreen,
          }}
        >
          {topGoal.progress.percentComplete}%
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: `${accentGreen}30`,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${progressWidth}%`,
            borderRadius: 3,
            backgroundColor: accentGreen,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 12,
            color: accentGreen,
            opacity: 0.8,
          }}
        >
          {formatMoney(topGoal.currentAmount as CopAmount)} /{" "}
          {formatMoney(topGoal.goal.targetAmount as CopAmount)}
        </Text>
        {moreCount > 0 ? (
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 11,
              color: accentGreen,
              opacity: 0.6,
            }}
          >
            {t("goals.smartCard.moreGoals", { count: String(moreCount) })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
