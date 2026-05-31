import { Stack } from "expo-router";
import { GoalCreateScreen } from "@/features/goals/routes.public";
import { useTranslation } from "@/shared/hooks";

export default function CreateGoalRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "",
          headerBackButtonDisplayMode: "minimal",
          headerTitle: t("goals.create.title"),
          title: t("goals.create.title"),
        }}
      />
      <GoalCreateScreen />
    </>
  );
}
