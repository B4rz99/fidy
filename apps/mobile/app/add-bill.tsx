import { Stack, useLocalSearchParams } from "expo-router";
import { AddBillScreen } from "@/features/calendar/routes.public";
import { useTranslation } from "@/shared/hooks";

export default function AddBillRoute() {
  const { t } = useTranslation();
  const { billId } = useLocalSearchParams<{ billId?: string | string[] }>();
  const title = billId == null ? t("bills.addBill") : t("bills.editBill");

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: title,
          title,
        }}
      />
      <AddBillScreen />
    </>
  );
}
