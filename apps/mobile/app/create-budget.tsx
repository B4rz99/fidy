import { Stack, useLocalSearchParams } from "expo-router";
import { CreateBudgetScreen } from "@/features/budget/routes.public";
import { useTranslation } from "@/shared/hooks";

export default function CreateBudgetRoute() {
  const { t } = useTranslation();
  const { budgetId } = useLocalSearchParams<{ budgetId?: string | string[] }>();
  const title = budgetId != null ? t("budgets.edit.title") : t("budgets.create.title");

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
      <CreateBudgetScreen />
    </>
  );
}
