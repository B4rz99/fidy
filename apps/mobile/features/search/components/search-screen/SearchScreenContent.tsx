import { ScreenLayout } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";
import { SearchInputBar } from "./SearchInputBar";
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
  peachLight,
  primary,
  ready,
  results,
  secondary,
  showSummary,
  summary,
}: SearchScreenViewModel) {
  const { t } = useTranslation();

  return (
    <ScreenLayout title={t("search.title")} variant="sub" onBack={onBack}>
      {ready ? (
        <>
          <SearchInputBar
            handleTextChange={handleTextChange}
            inputRef={inputRef}
            inputText={inputText}
            peachLight={peachLight}
            placeholder={t("search.placeholder")}
            primary={primary}
            secondary={secondary}
          />
          <SearchResultsList
            activePanel={activePanel}
            filterPanel={filterPanel}
            filters={filters}
            handleClearAll={handleClearAll}
            handleEndReached={handleEndReached}
            handleTogglePanel={handleTogglePanel}
            results={results}
            showSummary={showSummary}
            summary={summary}
          />
        </>
      ) : null}
    </ScreenLayout>
  );
}
