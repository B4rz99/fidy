import { Stack } from "expo-router";
import { CreateCategoryScreen } from "@/features/categories/routes.public";
import { useTranslation } from "@/shared/hooks";

export default function CreateCategoryRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
          headerTitle: t("categories.create.title"),
          title: t("categories.create.title"),
        }}
      />
      <CreateCategoryScreen />
    </>
  );
}
