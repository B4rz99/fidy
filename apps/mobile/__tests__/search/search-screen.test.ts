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
  expect(inputBarSource).toContain("Search");
  expect(listHeaderSource).toContain("filterDock");
  expect(summarySource).toContain("summaryCard");
  expect(summarySource).toContain("search.resultTotal");
  expect(summarySource).toContain("search.movements");
  expect(transactionItemSource).toContain("resultCard");
  expect(transactionItemSource).toContain("showDateHeader");
});
