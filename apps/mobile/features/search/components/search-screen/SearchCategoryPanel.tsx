import { CategoryFilter } from "../CategoryFilter";

type SearchCategoryPanelProps = {
  readonly handleCategoryToggle: (categoryId: string) => void;
  readonly selectedIds: readonly string[];
};

export function SearchCategoryPanel({
  handleCategoryToggle,
  selectedIds,
}: SearchCategoryPanelProps) {
  return <CategoryFilter selectedIds={selectedIds} onToggle={handleCategoryToggle} />;
}
