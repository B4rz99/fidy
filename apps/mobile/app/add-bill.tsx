import { AddBillScreen } from "@/features/calendar/routes.public";
import { DialogRouteFrame } from "@/shared/components";

export default function AddBillRoute() {
  return (
    <DialogRouteFrame>
      <AddBillScreen />
    </DialogRouteFrame>
  );
}
