import { GoalCreateSheet } from "@/features/goals/ui.public";
import { DialogRouteFrame } from "@/shared/components";

export default function CreateGoalRoute() {
  return (
    <DialogRouteFrame>
      <GoalCreateSheet />
    </DialogRouteFrame>
  );
}
