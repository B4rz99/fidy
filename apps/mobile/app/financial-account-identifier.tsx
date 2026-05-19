import { FinancialAccountIdentifierSheet } from "@/features/financial-accounts/routes.public";
import { DialogRouteFrame } from "@/shared/components";

export default function FinancialAccountIdentifierRoute() {
  return (
    <DialogRouteFrame>
      <FinancialAccountIdentifierSheet />
    </DialogRouteFrame>
  );
}
