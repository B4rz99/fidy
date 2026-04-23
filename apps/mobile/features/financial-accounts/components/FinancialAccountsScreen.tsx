import { FinancialAccountsScreenContent } from "./financial-accounts-screen/FinancialAccountsScreenContent";
import { useFinancialAccountsScreen } from "./financial-accounts-screen/useFinancialAccountsScreen";

export function FinancialAccountsScreen() {
  const screen = useFinancialAccountsScreen();

  return <FinancialAccountsScreenContent {...screen} />;
}
