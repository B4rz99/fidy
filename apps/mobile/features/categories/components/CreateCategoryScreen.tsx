import { useRouter } from "expo-router";
import { useTranslation } from "@/shared/hooks";
import { CreateCategoryScreenContent } from "./category-form/CreateCategoryScreenContent";
import { useCreateCategoryScreen } from "./category-form/useCreateCategoryScreen";

export function CreateCategoryScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const viewModel = useCreateCategoryScreen();

  return (
    <CreateCategoryScreenContent
      {...viewModel}
      headerTitle={t("categories.create.title")}
      onBack={back}
    />
  );
}
