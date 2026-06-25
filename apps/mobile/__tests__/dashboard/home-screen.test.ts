import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const homeScreenSource = readSource("../../features/dashboard/components/HomeScreen.tsx");
const contentSource = readSource(
  "../../features/dashboard/components/home-screen/HomeScreenContent.tsx"
);
const headerSource = readSource(
  "../../features/dashboard/components/home-screen/HomeScreenHeader.tsx"
);
const activityFeedSource = readSource(
  "../../features/dashboard/components/home-screen/useHomeActivityFeed.ts"
);
const homeModelSource = readSource(
  "../../features/dashboard/components/home-screen/useHomeScreen.ts"
);
const activityItemSource = readSource(
  "../../features/dashboard/components/home-screen/ActivityFeedItem.tsx"
);
const homeSpendingCardSource = readSource(
  "../../features/dashboard/components/home-screen/HomeSpendingCard.tsx"
);
const categoryBarColorsSource = readSource("../../shared/categories/bar-colors.ts");
const auroraBackgroundSource = readSource("../../shared/components/AppAuroraBackground.tsx");

test("keeps HomeScreen routed through the extracted dashboard modules", () => {
  expect(homeScreenSource).toContain("useHomeScreen");
  expect(homeScreenSource).toContain("<HomeScreenContent");
  expect(contentSource).toContain("<HomeScreenHeader");
  expect(contentSource).toContain("<ActivityFeedItem");
});

test("keeps home header actions wired through ScreenLayout", () => {
  const layoutSource = readSource("../../app/(tabs)/(index)/_layout.tsx");

  expect(contentSource).toContain("HomeScreenActions");
  expect(contentSource).toContain("ProfileAvatarButton");
  expect(contentSource).toContain("rightActions={headerActions}");
  expect(layoutSource).not.toContain("HomeScreenActions");
  expect(layoutSource).not.toContain("headerRight");
});

test("keeps the home activity feed wired to pagination and transaction mutations", () => {
  expect(activityFeedSource).toContain("activityQueryService");
  expect(activityFeedSource).toContain("loadPageWithCloudLedgerOptimisticView");
  expect(activityFeedSource).toContain("appendUniqueActivityItems");
  expect(activityFeedSource).toContain("deleteTransaction(db, userId, id)");
  expect(activityFeedSource).toContain('pathname: "/edit-transaction"');
});

test("keeps home budget guidance scoped to the current calendar month", () => {
  expect(homeModelSource).toContain("formatBudgetMonth(new Date())");
  expect(homeModelSource).toContain("selectedBudgetMonth === currentBudgetMonth");
  expect(homeModelSource).toContain("budgetTotalByMonth[currentBudgetMonth]");
  expect(homeModelSource).not.toContain("getBudgetsForMonth");
});

test("keeps activity item rendering memo-safe for edit and delete handlers", () => {
  expect(contentSource).not.toContain("onEdit={() =>");
  expect(contentSource).not.toContain("onDelete={() =>");
  expect(activityItemSource).toContain("onEditTransaction={onEditTransaction}");
  expect(activityItemSource).toContain("onDeleteTransaction={onDeleteTransaction}");
});

test("hides edit and delete actions for Cloud Ledger activity rows", () => {
  expect(activityItemSource).toContain('tx.source !== "cloud_ledger"');
  expect(activityItemSource).toContain("onEdit={canMutateTransaction ? handleEdit : undefined}");
  expect(activityItemSource).toContain(
    "onDelete={canMutateTransaction ? handleDelete : undefined}"
  );
});

test("keeps the home feed aurora background visible behind section headers and row cards", () => {
  const dateHeaderSource = readSource("../../shared/components/ListDateHeader.tsx");
  const transactionRowSource = readSource("../../shared/components/TransactionRow.tsx");
  const listRowSurfaceSource = readSource("../../shared/components/ListRowSurface.tsx");

  expect(dateHeaderSource).not.toContain("bg-page");
  expect(dateHeaderSource).not.toContain("dark:bg-page-dark");
  expect(activityItemSource).toContain("<ListDateHeader");
  expect(activityItemSource).not.toContain("activityCard");
  expect(transactionRowSource).toContain("<ListRowSurface");
  expect(listRowSurfaceSource).toContain("<SolidSurface");
  expect(transactionRowSource).toContain("styles.rowSurface");
});

test("keeps category emoji icons unbacked in transaction activity rows", () => {
  expect(activityItemSource).toContain("useAvailableCategoryMap");
  expect(activityItemSource).toContain("categoryById.get(tx.categoryId)");
  expect(activityItemSource).not.toContain("CATEGORY_MAP");
  expect(activityItemSource).toContain('iconBgColor="transparent"');
  expect(activityItemSource).toContain("iconBgColor={accentGreenLight}");
});

test("keeps monthly spending category bars on local light solid backgrounds", () => {
  expect(homeSpendingCardSource).toContain("<FlatList");
  expect(homeSpendingCardSource).toContain("horizontal");
  expect(homeSpendingCardSource).toContain("showsHorizontalScrollIndicator={false}");
  expect(homeSpendingCardSource).toContain("getCategoryBarBackgroundColor");
  expect(categoryBarColorsSource).toContain("CATEGORY_BAR_BACKGROUND_COLORS");
  expect(categoryBarColorsSource).toContain('clothing: "#D8E2EF"');
  expect(categoryBarColorsSource).toContain('entertainment: "#CBB7E8"');
  expect(categoryBarColorsSource).toContain('food: "#C4D6A4"');
  expect(categoryBarColorsSource).toContain('health: "#BFEAD8"');
  expect(homeSpendingCardSource).toContain("function CategoryBar");
  expect(homeSpendingCardSource).not.toContain("<Surface");
});

test("keeps the aurora blur mobile-friendly", () => {
  expect(auroraBackgroundSource).toContain('stdDeviation="14"');
  expect(auroraBackgroundSource).toContain("<G filter={`url(#${softAuroraBlurId})`}>");
  expect(auroraBackgroundSource).not.toContain('filter="url(#softAuroraBlur)"');
});

test("keeps dark mode aurora visible through the lower screen", () => {
  expect(auroraBackgroundSource).toMatch(/r=\{isDark \? "\d+%" : "\d+%"\}/);
  expect(auroraBackgroundSource).toMatch(/cy=\{isDark \? "\d+%" : "\d+%"\}/);
  expect(auroraBackgroundSource).toContain("stopOpacity={isDark ?");
});

test("keeps aurora SVG definitions instance-scoped", () => {
  expect(auroraBackgroundSource).toContain("useId");
  expect(auroraBackgroundSource).toContain('useId().replaceAll(":", "")');
  for (const id of [
    "topLeftGreenId",
    "topRightPeachId",
    "topRightPeachCoreId",
    "lowerLeftPeachId",
    "lowerRightGreenId",
    "bottomFadeId",
    "peachBandId",
    "greenBandId",
    "peachCoreBandId",
    "softAuroraBlurId",
  ]) {
    expect(auroraBackgroundSource).toContain(`id={${id}}`);
    expect(auroraBackgroundSource).toContain(`url(#${"${"}${id}})`);
  }
  expect(auroraBackgroundSource).not.toContain('id="topLeftGreen"');
  expect(auroraBackgroundSource).not.toContain('fill="url(#greenBand)"');
});

test("keeps the header wired to banners without main-card analytics navigation", () => {
  expect(headerSource).toContain("<EmailConnectBanner");
  expect(headerSource).toContain("<DetectedTransactionsBanner");
  expect(headerSource).toContain("<HomeSpendingCard");
  expect(headerSource).toContain('localQaProfile !== "home-activity"');
  expect(headerSource).not.toContain("const showReviewBanners =");
  expect(headerSource).toContain("const db = tryGetDb(userId);");
  expect(headerSource).not.toContain('push("/analytics" as never)');
});
