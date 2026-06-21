import { ScreenLayout, TextActionButton } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";
import { hasActiveFilters } from "../../lib/filters";
import { SearchResultsList } from "./SearchResultsList";
import type { SearchScreenViewModel } from "./SearchScreen.types";

export function SearchScreenContent({
  activePanel,
  filterPanel,
  filters,
  handleClearAll,
  handleEndReached,
  handleTextChange,
  handleTogglePanel,
  inputRef,
  inputText,
  onBack,
  primary,
  ready,
  results,
  secondary,
  showSummary,
  summary,
}: SearchScreenViewModel) {
  const { t } = useTranslation();
  const hasFilters = hasActiveFilters(filters);
  const clearFiltersAction = hasFilters ? (
    <TextActionButton label={t("common.clear")} tone="danger" onPress={handleClearAll} />
  ) : undefined;

  return (
    <ScreenLayout
      title={t("search.title")}
      variant="sub"
      onBack={onBack}
      rightActions={clearFiltersAction}
    >
      {ready ? (
        <SearchResultsList
          activePanel={activePanel}
          filterPanel={filterPanel}
          filters={filters}
          handleClearAll={handleClearAll}
          handleEndReached={handleEndReached}
          handleTextChange={handleTextChange}
          handleTogglePanel={handleTogglePanel}
          inputRef={inputRef}
          inputText={inputText}
          placeholder={t("search.placeholder")}
          primary={primary}
          results={results}
          secondary={secondary}
          showSummary={showSummary}
          summary={summary}
        />
      ) : null}
    </ScreenLayout>
  );
}
