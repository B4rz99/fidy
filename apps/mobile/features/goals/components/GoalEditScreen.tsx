import { AppAuroraBackground } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useColorScheme } from "@/shared/hooks";
import { useGoalStore } from "../store";
import { GoalEditScreenLoaded } from "./goal-form/GoalEditScreenLoaded";

export function GoalEditScreen() {
  const selectedGoalId = useGoalStore((state) => state.selectedGoalId);
  const goals = useGoalStore((state) => state.goals);
  const goal = goals.find((entry) => entry.goal.id === selectedGoalId)?.goal;
  const isDark = useColorScheme() === "dark";

  return selectedGoalId != null && goal != null ? (
    <GoalEditScreenLoaded key={goal.id} goal={goal} goalId={selectedGoalId} />
  ) : (
    <View style={{ flex: 1 }}>
      <AppAuroraBackground isDark={isDark} />
    </View>
  );
}
