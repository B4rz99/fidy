import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, expect, test } from "vitest";

async function readSource(relativePath: string) {
  return readFile(resolve(__dirname, relativePath), "utf-8");
}

let screenSource = "";
let contentSource = "";
let hookSource = "";
let rowSource = "";

beforeAll(async () => {
  screenSource = await readSource(
    "../../features/financial-accounts/components/FinancialAccountsScreen.tsx"
  );
  contentSource = await readSource(
    "../../features/financial-accounts/components/financial-accounts-screen/FinancialAccountsScreenContent.tsx"
  );
  hookSource = await readSource(
    "../../features/financial-accounts/components/financial-accounts-screen/useFinancialAccountsScreen.ts"
  );
  rowSource = await readSource(
    "../../features/financial-accounts/components/financial-accounts-screen/FinancialAccountRow.tsx"
  );
});

test("keeps FinancialAccountsScreen routed through extracted list modules", () => {
  expect(screenSource).toContain("useFinancialAccountsScreen");
  expect(screenSource).toContain("<FinancialAccountsScreenContent");
});

test("keeps the list hook wired to account lookup and navigation", () => {
  expect(hookSource).toContain("const db = tryGetDb(userId);");
  expect(hookSource).toContain("getFinancialAccountsForUser(db, userId)");
  expect(hookSource).toContain(
    "managementService.getAccountDetails({ db, accountId: account.id })"
  );
  expect(hookSource).toContain('pathname: "/financial-account-details"');
  expect(hookSource).toContain('router.push("/financial-account-form")');
});

test("keeps the extracted content wired to counted list sections and the header add action", () => {
  expect(contentSource).toContain("<FinancialAccountsSection");
  expect(contentSource).toContain('t("financialAccounts.list.regularSection")');
  expect(contentSource).toContain('t("financialAccounts.list.creditSection")');
  expect(contentSource).toContain("<FinancialAccountAddButton");
  expect(contentSource).toContain('t("financialAccounts.list.addLabel")');
  expect(contentSource).not.toContain("count={regularAccounts.length}");
  expect(contentSource).not.toContain("count={creditCardAccounts.length}");
  expect(contentSource).not.toContain('t("financialAccounts.list.addCta")');
});

test("matches the selected simple ledger account list direction", () => {
  expect(contentSource).toContain("<Stack.Screen options={{ headerShown: false }} />");
  expect(contentSource).toContain("includesNativeHeader={false}");
  expect(contentSource).toContain("centerAction={");
  expect(contentSource).toContain("styles.headerTitle");
  expect(contentSource).toContain("backgroundLayer={<FinancialAccountsAuroraLayer />}");
  expect(contentSource).toContain("styles.introCopy");
  expect(contentSource).not.toContain("styles.subtitle");
  expect(rowSource).toContain("styles.accountCard");
  expect(rowSource).toContain("styles.accountIcon");
  expect(rowSource).toContain("satisfies Record<");
});

test("keeps the extracted row wired to identifiers and billing-gap presentation", () => {
  expect(rowSource).toContain('t("financialAccounts.list.identifiersCount"');
  expect(rowSource).toContain('t("financialAccounts.list.billingGap")');
  expect(rowSource).toContain('t("financialAccounts.labels.default")');
});
