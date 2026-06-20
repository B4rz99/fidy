import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource("../../features/search/components/SearchScreen.tsx");
const contentSource = readSource(
  "../../features/search/components/search-screen/SearchScreenContent.tsx"
);
const hookSource = readSource("../../features/search/components/search-screen/useSearchScreen.tsx");
const controlsSource = readSource(
  "../../features/search/components/search-screen/useSearchScreenControls.ts"
);
const initHookSource = readSource(
  "../../features/search/components/search-screen/useSearchInitialization.ts"
);
const baseHookSource = readSource(
  "../../features/search/components/search-screen/useSearchScreenBase.ts"
);
const resultsListSource = readSource(
  "../../features/search/components/search-screen/SearchResultsList.tsx"
);
const filterControlsSource = readSource(
  "../../features/search/components/search-screen/SearchFilterControls.tsx"
);
const summarySource = readSource("../../features/search/components/ResultsSummary.tsx");
const transactionItemSource = readSource(
  "../../features/search/components/search-screen/SearchTransactionItem.tsx"
);
const inputBarSource = readSource(
  "../../features/search/components/search-screen/SearchInputBar.tsx"
);
const filterChipRowSource = readSource("../../features/search/components/FilterChipRow.tsx");
const categoryFilterSource = readSource("../../features/search/components/CategoryFilter.tsx");
const dateFilterSource = readSource("../../features/search/components/DateFilter.tsx");
const typeFilterSource = readSource("../../features/search/components/TypeFilter.tsx");
const filterChipItemSource = readSource("../../features/search/components/FilterChipItem.tsx");

test("keeps SearchScreen routed through the extracted search-screen modules", () => {
  expect(screenSource).toContain("useSearchScreen");
  expect(screenSource).toContain("<SearchScreenContent");
});

test("keeps the extracted search hook wired to route params and store state", () => {
  expect(hookSource).toContain("useSearchScreenBase");
  expect(hookSource).toContain("useSearchScreenControls");
  expect(hookSource).toContain("<SearchFilterPanelView");
  expect(hookSource).toContain("controls.panel.activePanel ? (");
  expect(baseHookSource).toContain("resolveSearchRouteFilters(routeParams)");
});

test("keeps search initialization wired to initial route filters and bootstrap search", () => {
  expect(initHookSource).toContain(
    "updateSearchFilters(args.db, args.userId, args.initialRouteFilters)"
  );
  expect(initHookSource).toContain("executeSearch(args.db, args.userId)");
  expect(initHookSource).toContain("args.reset();");
  expect(initHookSource).toContain("{ closing: false }");
  expect(initHookSource).not.toContain("fallbackMs: null");
});

test("keeps content and results rendering wired to the extracted list modules", () => {
  expect(contentSource).toContain("<SearchResultsList");
  expect(resultsListSource).toContain("<SearchFilterControls");
  expect(resultsListSource).toContain("<SearchTransactionItem");
  expect(resultsListSource).toContain("<FeedList");
});

test("keeps the transaction search redesign surfaces wired into the screen", () => {
  expect(contentSource).toContain('variant="sub"');
  expect(contentSource).not.toContain("rightActions={clearFiltersAction}");
  expect(contentSource).not.toContain("<TextActionButton");
  expect(contentSource).not.toContain('label={t("common.clear")}');
  expect(contentSource).not.toContain("<SearchInputBar");
  expect(inputBarSource).toContain("<FieldSurface");
  expect(inputBarSource).toContain("placeholder={placeholder}");
  expect(filterControlsSource).toContain("<SearchInputBar");
  expect(filterControlsSource).toContain("<FilterChipRow");
  expect(filterControlsSource).toContain("<SolidSurface");
  expect(resultsListSource).toContain("handleTextChange={handleTextChange}");
  expect(controlsSource).not.toContain("previousCategoryCount > 0");
  expect(controlsSource).not.toContain("panel.setActivePanel(null)");
  expect(summarySource).toContain("<SolidSurface");
  expect(summarySource).toContain("summaryCard");
  expect(summarySource).toContain("search.resultTotal");
  expect(summarySource).toContain("search.movements");
  expect(transactionItemSource).toContain("TransactionRow");
  expect(transactionItemSource).not.toContain("RaisedSurface");
  expect(transactionItemSource).toContain("showDateHeader");
});

test("keeps search filters aligned with the requested mobile interactions", () => {
  expect(filterChipRowSource).toContain("ItemSeparatorComponent={FilterChipSeparator}");
  expect(filterChipRowSource).toContain("width: 8");
  expect(filterChipRowSource).not.toContain("gap: 8");
  expect(categoryFilterSource).toContain("<FlatList");
  expect(categoryFilterSource).not.toContain("<ScrollView");
  expect(categoryFilterSource).not.toContain("<Check");
  expect(categoryFilterSource).toContain("CategoryIconButton");
  expect(categoryFilterSource).toContain('variant="filter"');
  expect(categoryFilterSource).toContain('useThemeColor("surfaceRaised")');
  expect(categoryFilterSource).toContain("idleColor={surfaceRaised}");
  expect(categoryFilterSource).not.toContain('className="h-0.5 w-5 rounded-full"');
  expect(categoryFilterSource).not.toContain("backgroundColor: isSelected ? category.color");
  expect(categoryFilterSource).not.toContain("peachLight");
  expect(categoryFilterSource).not.toContain(
    "backgroundColor: isSelected ? category.color : peachLight"
  );
  expect(dateFilterSource).toContain("TransactionDatePickerDialog");
  expect(dateFilterSource).not.toContain("<TextInput");
  expect(dateFilterSource).toContain("dimmed={activePresetKey !== null && !isActive}");
  expect(dateFilterSource).not.toContain("selectedColor={accentGreen}");
  expect(dateFilterSource).not.toContain("#2F7D32");
  expect(dateFilterSource).toContain("styles.lastMonthPreset");
  expect(typeFilterSource).not.toContain('style={getStyle("all")}');
  expect(typeFilterSource).toContain("SegmentedControl");
  expect(typeFilterSource).toContain('variant="detached"');
  expect(filterControlsSource).toContain('activePanel === "type" ? filterPanel : null');
  expect(filterControlsSource).toContain('activePanel !== "type"');
  expect(typeFilterSource).not.toContain("getOptionTone");
  expect(typeFilterSource).not.toContain('"danger"');
  expect(typeFilterSource).not.toContain('"success"');
  expect(typeFilterSource).toContain("search.transferType");
  expect(categoryFilterSource).toContain("dimmed={hasSelection && !isSelected}");
  expect(categoryFilterSource).not.toContain("<View style={{ opacity }}>");
  expect(categoryFilterSource).not.toContain("selectedColor={accentGreen}");
  expect(filterChipRowSource).not.toContain('"clearAll"');
  expect(filterChipItemSource).toContain("dimmed={hasActiveFilters && !isHighlighted}");
  expect(filterChipItemSource).toContain('tone="neutral"');
  expect(filterChipItemSource).not.toContain('isActive ? "primary" : "neutral"');
  expect(transactionItemSource).toContain("getTransferActivityCopy");
});
