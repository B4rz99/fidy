import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import ts from "typescript";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { i18n, useLocaleStore } from "@/shared/i18n";
import { createFinancialAccountFixture } from "./fixtures";

vi.mock("expo-router", () => ({
  Stack: {
    Screen: "Stack.Screen",
  },
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function readSource(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf-8");
}

const screenSource = readSource(
  "../../features/financial-accounts/components/FinancialAccountsScreen.tsx"
);
const hookSource = readSource(
  "../../features/financial-accounts/components/financial-accounts-screen/useFinancialAccountsScreen.ts"
);
const contentSource = readSource(
  "../../features/financial-accounts/components/financial-accounts-screen/FinancialAccountsScreenContent.tsx"
);
const sectionSource = readSource(
  "../../features/financial-accounts/components/financial-accounts-screen/FinancialAccountsSection.tsx"
);
const rowSource = readSource(
  "../../features/financial-accounts/components/financial-accounts-screen/FinancialAccountRow.tsx"
);

type TestFinancialAccountListItem = {
  readonly account: ReturnType<typeof createFinancialAccountFixture>;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};

type FinancialAccountRowProps = {
  readonly item: TestFinancialAccountListItem;
  readonly onPress: () => void;
};

type FinancialAccountsSectionProps = {
  readonly items: readonly TestFinancialAccountListItem[];
  readonly label: string;
  readonly onOpenAccount: (accountId: TestFinancialAccountListItem["account"]["id"]) => void;
};

type FinancialAccountsScreenContentProps = {
  readonly creditCardAccounts: readonly TestFinancialAccountListItem[];
  readonly onAddAccount: () => void;
  readonly onBack: () => void;
  readonly onOpenAccount: (accountId: TestFinancialAccountListItem["account"]["id"]) => void;
  readonly regularAccounts: readonly TestFinancialAccountListItem[];
};

let FinancialAccountRowComponent: ComponentType<FinancialAccountRowProps>;
let FinancialAccountsSectionComponent: ComponentType<FinancialAccountsSectionProps>;
let FinancialAccountsScreenContentComponent: ComponentType<FinancialAccountsScreenContentProps>;

const regularAccountItem: TestFinancialAccountListItem = {
  account: createFinancialAccountFixture({
    id: "fa-regular" as TestFinancialAccountListItem["account"]["id"],
    name: "Cash",
    kind: "checking",
    isDefault: true,
  }),
  identifiersCount: 2,
  hasBillingProfileGap: false,
};

const creditCardAccountItem: TestFinancialAccountListItem = {
  account: createFinancialAccountFixture({
    id: "fa-credit" as TestFinancialAccountListItem["account"]["id"],
    name: "Visa gold",
    kind: "credit_card",
    isDefault: false,
  }),
  identifiersCount: 1,
  hasBillingProfileGap: true,
};

beforeAll(async () => {
  const rowModule =
    await import("@/features/financial-accounts/components/financial-accounts-screen/FinancialAccountRow");
  const sectionModule =
    await import("@/features/financial-accounts/components/financial-accounts-screen/FinancialAccountsSection");
  const contentModule =
    await import("@/features/financial-accounts/components/financial-accounts-screen/FinancialAccountsScreenContent");

  FinancialAccountRowComponent = rowModule.FinancialAccountRow;
  FinancialAccountsSectionComponent = sectionModule.FinancialAccountsSection;
  FinancialAccountsScreenContentComponent = contentModule.FinancialAccountsScreenContent;
});

beforeEach(() => {
  i18n.locale = "en";
  useLocaleStore.setState({ locale: "en" });
});

function parseSource(source: string) {
  return ts.createSourceFile(
    "test-source.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function collectNodes(sourceFile: ts.SourceFile) {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return nodes;
}

function hasImport(sourceFile: ts.SourceFile, importedName: string) {
  return sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings != null &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === importedName
      )
  );
}

function hasCall(sourceFile: ts.SourceFile, calleeName: string) {
  return collectNodes(sourceFile).some(
    (node) =>
      ts.isCallExpression(node) &&
      (ts.isIdentifier(node.expression)
        ? node.expression.text === calleeName
        : isPropertyCall(node.expression, calleeName))
  );
}

function isPropertyCall(expression: ts.Expression, calleeName: string) {
  if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== calleeName) {
    return false;
  }

  if (calleeName !== "push") {
    return true;
  }

  return (
    ts.isIdentifier(expression.expression) &&
    ["navigation", "router"].includes(expression.expression.text)
  );
}

function hasJsxComponent(sourceFile: ts.SourceFile, componentName: string) {
  return collectNodes(sourceFile).some(
    (node) =>
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === componentName
  );
}

test("keeps FinancialAccountsScreen routed through extracted list modules", () => {
  const sourceFile = parseSource(screenSource);

  expect(hasImport(sourceFile, "useFinancialAccountsScreen")).toBe(true);
  expect(hasJsxComponent(sourceFile, "FinancialAccountsScreenContent")).toBe(true);
});

test("keeps the list hook wired to account lookup and navigation", () => {
  const sourceFile = parseSource(hookSource);

  expect(hasCall(sourceFile, "tryGetDb")).toBe(true);
  expect(hasCall(sourceFile, "getFinancialAccountsForUser")).toBe(true);
  expect(hasCall(sourceFile, "getAccountDetails")).toBe(true);
  expect(hasCall(sourceFile, "push")).toBe(true);
});

test("keeps financial accounts content composed from sections and rows", () => {
  const contentFile = parseSource(contentSource);
  const sectionFile = parseSource(sectionSource);
  const rowFile = parseSource(rowSource);

  expect(hasJsxComponent(contentFile, "FinancialAccountsSection")).toBe(true);
  expect(hasJsxComponent(contentFile, "ScreenLayout")).toBe(true);
  expect(contentSource).toContain("regularAccounts");
  expect(contentSource).toContain("creditCardAccounts");
  expect(contentSource).toContain("financialAccounts.list.addLabel");
  expect(contentSource).toContain("rightActions={");
  expect(contentSource).toContain("EmptyState");
  expect(contentSource).not.toContain("<Stack.Screen");
  expect(contentSource).not.toContain("includesNativeHeader={false}");

  expect(hasJsxComponent(sectionFile, "FinancialAccountRow")).toBe(true);
  expect(sectionSource).toContain("items.length");
  expect(sectionSource).toContain("onOpenAccount(item.account.id)");

  expect(hasJsxComponent(rowFile, "ListRowSurface")).toBe(true);
  expect(rowSource).toContain("financialAccounts.list.identifiersCount");
  expect(rowSource).toContain("financialAccounts.labels.default");
  expect(rowSource).toContain("financialAccounts.list.billingGap");
});

describe("financial account list extracted components", () => {
  test("renders content sections, add action, and empty state", () => {
    const withItems = renderFidy(
      <FinancialAccountsScreenContentComponent
        regularAccounts={[regularAccountItem]}
        creditCardAccounts={[creditCardAccountItem]}
        onAddAccount={vi.fn()}
        onBack={vi.fn()}
        onOpenAccount={vi.fn()}
      />
    );

    expect(withItems.getByText("Cash")).toBeTruthy();
    expect(withItems.getByText("Visa gold")).toBeTruthy();

    const empty = renderFidy(
      <FinancialAccountsScreenContentComponent
        regularAccounts={[]}
        creditCardAccounts={[]}
        onAddAccount={vi.fn()}
        onBack={vi.fn()}
        onOpenAccount={vi.fn()}
      />
    );

    expect(empty.getByText("No financial accounts yet")).toBeTruthy();
  });

  test("renders rows and opens the selected account from a section", () => {
    const onOpenAccount = vi.fn();
    const screen = renderFidy(
      <FinancialAccountsSectionComponent
        label="Regular accounts"
        items={[regularAccountItem]}
        onOpenAccount={onOpenAccount}
      />
    );

    expect(screen.getByText("Regular accounts")).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();

    screen.pressByText("Cash");

    expect(onOpenAccount).toHaveBeenCalledWith("fa-regular");
  });

  test("renders financial account row surface content and status labels", () => {
    const screen = renderFidy(
      <FinancialAccountRowComponent item={creditCardAccountItem} onPress={vi.fn()} />
    );

    expect(screen.getByText("Visa gold")).toBeTruthy();
    expect(screen.getByText(/Credit card.*1 identifier/)).toBeTruthy();
    expect(screen.getByText("Card cycle dates missing")).toBeTruthy();
  });

  test("renders the default badge on default account rows", () => {
    const screen = renderFidy(
      <FinancialAccountRowComponent item={regularAccountItem} onPress={vi.fn()} />
    );

    expect(screen.getByText("Default")).toBeTruthy();
  });
});
