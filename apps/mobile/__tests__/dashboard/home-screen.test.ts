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
const activityItemSource = readSource(
  "../../features/dashboard/components/home-screen/ActivityFeedItem.tsx"
);

test("keeps HomeScreen routed through the extracted dashboard modules", () => {
  expect(homeScreenSource).toContain("useHomeScreen");
  expect(homeScreenSource).toContain("<HomeScreenContent");
  expect(contentSource).toContain("<HomeScreenHeader");
  expect(contentSource).toContain("<ActivityFeedItem");
});

test("keeps the home activity feed wired to pagination and transaction mutations", () => {
  expect(activityFeedSource).toContain("activityQueryService.loadPage");
  expect(activityFeedSource).toContain("appendUniqueActivityItems");
  expect(activityFeedSource).toContain("deleteTransaction(db, userId, id)");
  expect(activityFeedSource).toContain('pathname: "/edit-transaction"');
});

test("keeps activity item rendering memo-safe for edit and delete handlers", () => {
  expect(contentSource).not.toContain("onEdit={() =>");
  expect(contentSource).not.toContain("onDelete={() =>");
  expect(activityItemSource).toContain("onEditTransaction={onEditTransaction}");
  expect(activityItemSource).toContain("onDeleteTransaction={onDeleteTransaction}");
});

test("keeps the header wired to banners and analytics navigation", () => {
  expect(headerSource).toContain("<EmailConnectBanner");
  expect(headerSource).toContain("<DetectedTransactionsBanner");
  expect(headerSource).toContain("const db = tryGetDb(userId);");
  expect(headerSource).toContain('push("/analytics" as never)');
});
