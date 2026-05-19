import { GoalEditSheet } from "@/features/goals/ui.public";
import { DialogRouteFrame } from "@/shared/components";

export default function EditGoalRoute() {
  return (
    <DialogRouteFrame>
      <GoalEditSheet />
    </DialogRouteFrame>
  );
}
