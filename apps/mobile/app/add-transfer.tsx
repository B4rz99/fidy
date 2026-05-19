import { Stack, useRouter } from "expo-router";
import { PencilTransferEntryScreen } from "@/features/transfers/routes.public";
import { DialogRouteFrame } from "@/shared/components";

export default function AddTransferRoute() {
  const { replace } = useRouter();

  const handleTransactionTabSelect = () => {
    replace("/add-transaction");
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <DialogRouteFrame>
        <PencilTransferEntryScreen onTransactionTabSelect={handleTransactionTabSelect} />
      </DialogRouteFrame>
    </>
  );
}
