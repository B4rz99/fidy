import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

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
  expect(contentSource).toContain("regularAccounts");
  expect(contentSource).toContain("creditCardAccounts");
  expect(contentSource).toContain("financialAccounts.list.addLabel");
  expect(contentSource).toContain("EmptyState");

  expect(hasJsxComponent(sectionFile, "FinancialAccountRow")).toBe(true);
  expect(sectionSource).toContain("items.length");
  expect(sectionSource).toContain("onOpenAccount(item.account.id)");

  expect(hasJsxComponent(rowFile, "GlassSurface")).toBe(true);
  expect(rowSource).toContain("financialAccounts.list.identifiersCount");
  expect(rowSource).toContain("financialAccounts.labels.default");
  expect(rowSource).toContain("financialAccounts.list.billingGap");
});
