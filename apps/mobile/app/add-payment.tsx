import { Stack } from "expo-router";
import { AddPaymentSheet } from "@/features/goals/ui.public";
import { useTranslation } from "@/shared/hooks";

export default function AddPaymentRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: t("goals.payment.title"),
          title: t("goals.payment.title"),
        }}
      />
      <AddPaymentSheet />
    </>
  );
}
