import { Stack } from "expo-router";
import { PencilTransferEntryScreen } from "@/features/transfers/routes.public";

export default function AddTransferRoute() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <PencilTransferEntryScreen />
    </>
  );
}
