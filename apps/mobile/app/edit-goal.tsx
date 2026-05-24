import { Stack } from "expo-router";
import { GoalEditSheet } from "@/features/goals/ui.public";
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
      <GoalEditSheet />
    </>
  );
}
