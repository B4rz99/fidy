import { CreateBudgetScreen } from "@/features/budget/routes.public";
import { DialogRouteFrame } from "@/shared/components";

export default function CreateBudgetRoute() {
  return (
    <DialogRouteFrame>
      <CreateBudgetScreen />
    </DialogRouteFrame>
  );
}
