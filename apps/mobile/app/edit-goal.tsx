import { Stack } from "expo-router";
import { GoalEditScreen } from "@/features/goals/routes.public";
import { useTranslation } from "@/shared/hooks";

export default function EditGoalRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: t("goals.edit.title"),
          title: t("goals.edit.title"),
        }}
      />
      <GoalEditScreen />
    </>
  );
}
