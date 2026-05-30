import { Button, EmptyState } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

type SearchEmptyStateProps = {
  onClearFilters: () => void;
};

export const SearchEmptyState = ({ onClearFilters }: SearchEmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      title={t("search.noResults")}
      className="pt-16"
      action={
        <Button
          label={t("search.clearFilters")}
          variant="ghost"
          size="compact"
          onPress={onClearFilters}
          className="mt-2"
        />
      }
    />
  );
};
