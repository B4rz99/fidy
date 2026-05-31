import { Stack, useRouter } from "expo-router";
import { TransferEntryScreen } from "@/features/transfers/routes.public";

export default function AddTransferRoute() {
  const { replace } = useRouter();

  const handleTransactionTabSelect = () => {
    replace("/add-transaction");
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <TransferEntryScreen
        includesNativeHeader={false}
        onTransactionTabSelect={handleTransactionTabSelect}
      />
    </>
  );
}
