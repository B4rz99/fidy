import { Stack } from "expo-router";
import { PencilTransactionEntryScreen } from "@/features/transactions/routes.public";
import { DialogRouteFrame } from "@/shared/components";

export default function AddTransactionRoute() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <DialogRouteFrame>
        <PencilTransactionEntryScreen includesNativeHeader={false} />
      </DialogRouteFrame>
    </>
  );
}
