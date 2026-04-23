import { FinancialAccountDetailsScreenContent } from "./financial-account-details-screen/FinancialAccountDetailsScreenContent";
import { useFinancialAccountDetailsScreen } from "./financial-account-details-screen/useFinancialAccountDetailsScreen";

export function FinancialAccountDetailsScreen() {
  const screen = useFinancialAccountDetailsScreen();

  return <FinancialAccountDetailsScreenContent {...screen} />;
}
