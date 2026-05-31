import { Stack } from "expo-router";
import { PencilTransactionEntryScreen } from "@/features/transactions/routes.public";

export default function AddTransactionRoute() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <PencilTransactionEntryScreen includesNativeHeader={false} />
    </>
  );
}
