import { ScreenLayout } from "@/shared/components";
import { Platform, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
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
          <View style={styles.nativeHeaderClearance} />
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
            peachLight={peachLight}
            placeholder={t("search.placeholder")}
            primary={primary}
            results={results}
            secondary={secondary}
            showSummary={showSummary}
            summary={summary}
          />
        </>
      ) : null}
    </ScreenLayout>
  );
}

const styles = {
  nativeHeaderClearance: {
    height: Platform.OS === "ios" ? 116 : 0,
  },
};
