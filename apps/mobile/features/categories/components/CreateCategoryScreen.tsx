import { CreateCategoryScreenContent } from "./category-form/CreateCategoryScreenContent";
import { useCreateCategoryScreen } from "./category-form/useCreateCategoryScreen";

export function CreateCategoryScreen() {
  const viewModel = useCreateCategoryScreen();

  return <CreateCategoryScreenContent {...viewModel} />;
}
