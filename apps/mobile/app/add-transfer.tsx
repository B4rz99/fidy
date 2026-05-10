import { Stack, useRouter } from "expo-router";
import { PencilTransferEntryScreen } from "@/features/transfers/routes.public";

export default function AddTransferRoute() {
  const { replace } = useRouter();

  const handleTransactionTabSelect = () => {
    replace("/add-transaction");
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <PencilTransferEntryScreen onTransactionTabSelect={handleTransactionTabSelect} />
    </>
  );
}
