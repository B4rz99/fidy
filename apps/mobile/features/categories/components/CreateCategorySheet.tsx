import { CreateCategorySheetContent } from "./category-sheet/CreateCategorySheetContent";
import { useCreateCategorySheet } from "./category-sheet/useCreateCategorySheet";

export function CreateCategorySheet() {
  const viewModel = useCreateCategorySheet();

  return <CreateCategorySheetContent {...viewModel} />;
}
