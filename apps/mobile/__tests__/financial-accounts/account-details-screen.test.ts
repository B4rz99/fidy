import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource(
  "../../features/financial-accounts/components/FinancialAccountDetailsScreen.tsx"
);
const contentSource = readSource(
  "../../features/financial-accounts/components/financial-account-details-screen/FinancialAccountDetailsScreenContent.tsx"
);
const hookSource = readSource(
  "../../features/financial-accounts/components/financial-account-details-screen/useFinancialAccountDetailsScreen.ts"
);
const helperSource = readSource(
  "../../features/financial-accounts/components/financial-account-details-screen/FinancialAccountDetails.helpers.ts"
);

test("keeps FinancialAccountDetailsScreen routed through extracted detail modules", () => {
  expect(screenSource).toContain("useFinancialAccountDetailsScreen");
  expect(screenSource).toContain("<FinancialAccountDetailsScreenContent");
});

test("keeps the details hook wired to account lookup and detail actions", () => {
  expect(hookSource).toContain("const db = tryGetDb(userId);");
  expect(hookSource).toContain("managementService.getAccountDetails({ db, accountId })");
  expect(hookSource).toContain('pathname: "/financial-account-identifier"');
  expect(hookSource).toContain('pathname: "/financial-account-form"');
});

test("keeps the extracted detail content wired to the hero, billing gap, and identifiers", () => {
  expect(contentSource).toContain("<FinancialAccountDetailsHero");
  expect(contentSource).toContain('t("financialAccounts.detail.billingGapTitle")');
  expect(contentSource).toContain("<FinancialAccountIdentifiersSection");
  expect(contentSource).toContain('t("financialAccounts.detail.editCta")');
});

test("keeps the detail helpers responsible for balance labels and effective-date formatting", () => {
  expect(helperSource).toContain("getOpeningBalanceLabelKey");
  expect(helperSource).toContain("formatOpeningBalanceEffectiveDate");
  expect(helperSource).toContain('format(parsedDate, "PPP"');
});
