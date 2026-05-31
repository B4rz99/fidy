import { Stack } from "expo-router";
import { TransactionEntryScreen } from "@/features/transactions/routes.public";

export default function AddTransactionRoute() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <TransactionEntryScreen includesNativeHeader={false} />
    </>
  );
}
