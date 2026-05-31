import { Stack } from "expo-router";
import { CreateBudgetScreen } from "@/features/budget/routes.public";
import { useTranslation } from "@/shared/hooks";

export default function CreateBudgetRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: t("budgets.create.title"),
          title: t("budgets.create.title"),
        }}
      />
      <CreateBudgetScreen />
    </>
  );
}
