import { CreateCategorySheet } from "@/features/categories";
import { DialogRouteFrame } from "@/shared/components";

export default function CreateCategoryRoute() {
  return (
    <DialogRouteFrame>
      <CreateCategorySheet />
    </DialogRouteFrame>
  );
}
