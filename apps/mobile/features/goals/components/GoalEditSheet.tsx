import { AppAuroraBackground } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor } from "@/shared/hooks";
import { useGoalStore } from "../store";
import { GoalEditSheetLoaded } from "./goal-sheet/GoalEditSheetLoaded";

export function GoalEditSheet() {
  const selectedGoalId = useGoalStore((state) => state.selectedGoalId);
  const goals = useGoalStore((state) => state.goals);
  const goal = goals.find((entry) => entry.goal.id === selectedGoalId)?.goal;
  const isDark = useColorScheme() === "dark";
  const page = useThemeColor("page");

  return selectedGoalId != null && goal != null ? (
    <GoalEditSheetLoaded key={goal.id} goal={goal} goalId={selectedGoalId} />
  ) : (
    <View style={{ flex: 1, backgroundColor: page }}>
      <AppAuroraBackground isDark={isDark} />
    </View>
  );
}
