import { useGoalStore } from "../store";
import { GoalEditSheetLoaded } from "./goal-sheet/GoalEditSheetLoaded";

export function GoalEditSheet() {
  const selectedGoalId = useGoalStore((state) => state.selectedGoalId);
  const goals = useGoalStore((state) => state.goals);
  const goal = goals.find((entry) => entry.goal.id === selectedGoalId)?.goal;

  return selectedGoalId != null && goal != null ? (
    <GoalEditSheetLoaded key={goal.id} goal={goal} goalId={selectedGoalId} />
  ) : null;
}
