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
const listHeaderSource = readSource(
  "../../features/search/components/search-screen/SearchListHeader.tsx"
);
const summarySource = readSource("../../features/search/components/ResultsSummary.tsx");
const transactionItemSource = readSource(
  "../../features/search/components/search-screen/SearchTransactionItem.tsx"
);
const inputBarSource = readSource(
  "../../features/search/components/search-screen/SearchInputBar.tsx"
);
const categoryFilterSource = readSource("../../features/search/components/CategoryFilter.tsx");
const dateFilterSource = readSource("../../features/search/components/DateFilter.tsx");
const typeFilterSource = readSource("../../features/search/components/TypeFilter.tsx");

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
  expect(resultsListSource).toContain("<SearchListHeader");
  expect(resultsListSource).toContain("<SearchTransactionItem");
});

test("keeps the transaction search redesign surfaces wired into the screen", () => {
  expect(contentSource).toContain('variant="sub"');
  expect(contentSource).not.toContain("<SearchInputBar");
  expect(inputBarSource).toContain("placeholder={placeholder}");
  expect(listHeaderSource).toContain("<SearchInputBar");
  expect(resultsListSource).toContain("handleTextChange={handleTextChange}");
  expect(controlsSource).not.toContain("previousCategoryCount > 0");
  expect(controlsSource).not.toContain("panel.setActivePanel(null)");
  expect(summarySource).toContain("summaryCard");
  expect(summarySource).toContain("search.resultTotal");
  expect(summarySource).toContain("search.movements");
  expect(transactionItemSource).toContain("resultCard");
  expect(transactionItemSource).toContain("showDateHeader");
});

test("keeps search filters aligned with the requested mobile interactions", () => {
  expect(categoryFilterSource).not.toContain("<Check");
  expect(categoryFilterSource).toContain('className="h-11 w-11');
  expect(categoryFilterSource).toContain('className="h-0.5 w-5 rounded-full"');
  expect(categoryFilterSource).toContain("backgroundColor: peachLight");
  expect(categoryFilterSource).not.toContain(
    "backgroundColor: isSelected ? category.color : peachLight"
  );
  expect(dateFilterSource).toContain("TransactionDatePickerSheet");
  expect(dateFilterSource).not.toContain("<TextInput");
  expect(dateFilterSource).toContain('preset.key === "lastMonth" ? { flex: 1.35 } : { flex: 1 }');
  expect(typeFilterSource).not.toContain('style={getStyle("all")}');
  expect(typeFilterSource).toContain('style={getStyle("transfer")}');
  expect(typeFilterSource).toContain("search.transfers");
  expect(transactionItemSource).toContain("getTransferActivityCopy");
});
