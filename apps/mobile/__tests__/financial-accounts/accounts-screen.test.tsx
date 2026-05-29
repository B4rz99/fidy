import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { FinancialAccountsScreenContent } from "@/features/financial-accounts/components/financial-accounts-screen/FinancialAccountsScreenContent";
import type { FinancialAccountListItem } from "@/features/financial-accounts/components/financial-accounts-screen/FinancialAccountsScreen.types";
import { i18n, useLocaleStore } from "@/shared/i18n";
import type { FinancialAccountId } from "@/shared/types/branded";
import { createFinancialAccountFixture } from "./fixtures";

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource(
  "../../features/financial-accounts/components/FinancialAccountsScreen.tsx"
);
const hookSource = readSource(
  "../../features/financial-accounts/components/financial-accounts-screen/useFinancialAccountsScreen.ts"
);

const checkingAccount = {
  account: createFinancialAccountFixture({
    id: "fa-checking" as FinancialAccountId,
    name: "Bancolombia checking",
    kind: "checking",
    isDefault: true,
  }),
  identifiersCount: 2,
  hasBillingProfileGap: false,
} satisfies FinancialAccountListItem;

const cashAccount = {
  account: createFinancialAccountFixture({
    id: "fa-cash" as FinancialAccountId,
    name: "Cash pocket",
    kind: "cash",
    isDefault: false,
  }),
  identifiersCount: 3,
  hasBillingProfileGap: false,
} satisfies FinancialAccountListItem;

const creditCardAccount = {
  account: createFinancialAccountFixture({
    id: "fa-card" as FinancialAccountId,
    name: "Visa gold",
    kind: "credit_card",
    isDefault: false,
  }),
  identifiersCount: 1,
  hasBillingProfileGap: true,
} satisfies FinancialAccountListItem;

beforeEach(() => {
  i18n.locale = "en";
  useLocaleStore.setState({ locale: "en" });
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

describe("FinancialAccountsScreenContent", () => {
  test("renders account sections and one row per account", () => {
    const screen = renderFidy(
      <FinancialAccountsScreenContent
        regularAccounts={[checkingAccount, cashAccount]}
        creditCardAccounts={[creditCardAccount]}
        onAddAccount={vi.fn()}
        onBack={vi.fn()}
        onOpenAccount={vi.fn()}
      />
    );

    expect(screen.getByText("Cash and bank accounts")).toBeTruthy();
    expect(screen.getByText("Credit cards")).toBeTruthy();
    expect(screen.getByText("Bancolombia checking")).toBeTruthy();
    expect(screen.getByText("Cash pocket")).toBeTruthy();
    expect(screen.getByText("Visa gold")).toBeTruthy();
  });

  test("renders add action, kind labels, identifiers, and conditional row UI", () => {
    const screen = renderFidy(
      <FinancialAccountsScreenContent
        regularAccounts={[checkingAccount, cashAccount]}
        creditCardAccounts={[creditCardAccount]}
        onAddAccount={vi.fn()}
        onBack={vi.fn()}
        onOpenAccount={vi.fn()}
      />
    );

    expect(screen.getByA11yLabel("Add account")).toBeTruthy();
    expect(screen.getByText(/Checking.*2 identifiers/)).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText(/Credit card.*1 identifier/)).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("Card cycle dates missing")).toBeTruthy();
  });

  test("calls the add action and row open action", () => {
    const onAddAccount = vi.fn();
    const onOpenAccount = vi.fn();
    const screen = renderFidy(
      <FinancialAccountsScreenContent
        regularAccounts={[checkingAccount]}
        creditCardAccounts={[]}
        onAddAccount={onAddAccount}
        onBack={vi.fn()}
        onOpenAccount={onOpenAccount}
      />
    );

    screen.pressByA11yLabel("Add account");
    screen.pressByText("Bancolombia checking");

    expect(onAddAccount).toHaveBeenCalledOnce();
    expect(onOpenAccount).toHaveBeenCalledWith("fa-checking");
  });
});
