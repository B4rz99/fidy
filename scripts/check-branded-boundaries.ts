#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export const DEFAULT_MOBILE_ROOT = "apps/mobile";

const GENERATED_DIRECTORY_NAMES = new Set(["android", "ios", "node_modules"]);

const UI_PATH_RULES = [
  {
    label: "app/**",
    matches: (filePath: string, mobileRoot: string) => filePath.startsWith(`${mobileRoot}/app/`),
  },
  {
    label: "features/**/components/**",
    matches: (filePath: string, mobileRoot: string) =>
      new RegExp(`^${mobileRoot}/features/.+/components/`).test(filePath),
  },
  {
    label: "shared/components/**",
    matches: (filePath: string, mobileRoot: string) =>
      filePath.startsWith(`${mobileRoot}/shared/components/`),
  },
] as const;

export const ALLOWED_BOUNDARY_HINTS = [
  "apps/mobile/shared/types/assertions.ts",
  "apps/mobile/shared/lib/format-date.ts",
  "apps/mobile/shared/lib/generate-id.ts",
  "apps/mobile/**/schema.ts",
  "apps/mobile/**/data/**",
  "apps/mobile/**/repository/**",
  "apps/mobile/features/auth/public.ts",
];

export type Violation = {
  readonly brandNames: readonly string[];
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly expressionText: string;
  readonly uiRule: (typeof UI_PATH_RULES)[number]["label"];
};

export type BoundaryCheckOptions = {
  readonly rootDir?: string;
  readonly mobileRoot?: string;
};

type BrandedImportContext = {
  readonly brandedTypeNames: ReadonlySet<string>;
  readonly directAliases: ReadonlyMap<string, string>;
  readonly namespaceAliases: ReadonlySet<string>;
};

function listRepoFiles(dirPath: string): readonly string[] {
  return readdirSync(dirPath).flatMap((entry) => {
    if (GENERATED_DIRECTORY_NAMES.has(entry)) {
      return [];
    }

    const absolutePath = path.join(dirPath, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return listRepoFiles(absolutePath);
    }

    return [absolutePath];
  });
}

function readBrandedTypeNames(filePath: string): ReadonlySet<string> {
  const content = readFileSync(filePath, "utf8");
  const matches = [...content.matchAll(/export type (\w+) = Brand</g)];
  return new Set(matches.map((match) => match[1]).filter((name): name is string => name != null));
}

function normalizePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function getUiRule(filePath: string, mobileRoot: string): (typeof UI_PATH_RULES)[number] | null {
  return UI_PATH_RULES.find((rule) => rule.matches(filePath, mobileRoot)) ?? null;
}

function isSourceFile(filePath: string): boolean {
  return /\.(ts|tsx)$/.test(filePath);
}

function isTestFile(filePath: string): boolean {
  return filePath.includes("/__tests__/") || /\.test\.(ts|tsx)$/.test(filePath);
}

function collectBrandedImportContext(
  sourceFile: ts.SourceFile,
  brandedTypeNames: ReadonlySet<string>
): BrandedImportContext {
  const directAliases = new Map<string, string>();
  const namespaceAliases = new Set<string>();

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return;
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier) || moduleSpecifier.text !== "@/shared/types/branded") {
      return;
    }

    const importClause = statement.importClause;
    if (importClause == null || importClause.namedBindings == null) {
      return;
    }

    if (ts.isNamespaceImport(importClause.namedBindings)) {
      namespaceAliases.add(importClause.namedBindings.name.text);
      return;
    }

    importClause.namedBindings.elements.forEach((element) => {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (!brandedTypeNames.has(importedName)) {
        return;
      }

      directAliases.set(element.name.text, importedName);
    });
  });

  return {
    brandedTypeNames,
    directAliases,
    namespaceAliases,
  };
}

function getLeftmostIdentifier(entityName: ts.EntityName): string {
  return ts.isIdentifier(entityName) ? entityName.text : getLeftmostIdentifier(entityName.left);
}

function resolveBrandNamesFromEntityName(
  entityName: ts.EntityName,
  importContext: BrandedImportContext
): readonly string[] {
  if (ts.isIdentifier(entityName)) {
    const directMatch = importContext.directAliases.get(entityName.text);
    return directMatch == null ? [] : [directMatch];
  }

  const leftmostIdentifier = getLeftmostIdentifier(entityName);
  const rightmostIdentifier = entityName.right.text;
  const isBrandedNamespace =
    importContext.namespaceAliases.has(leftmostIdentifier) &&
    importContext.brandedTypeNames.has(rightmostIdentifier);

  return isBrandedNamespace ? [rightmostIdentifier] : [];
}

function collectTypeNames(
  typeNode: ts.TypeNode,
  importContext: BrandedImportContext
): readonly string[] {
  if (ts.isTypeReferenceNode(typeNode)) {
    return resolveBrandNamesFromEntityName(typeNode.typeName, importContext);
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectTypeNames(typeNode.type, importContext);
  }

  if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
    return [...new Set(typeNode.types.flatMap((part) => collectTypeNames(part, importContext)))];
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return collectTypeNames(typeNode.elementType, importContext);
  }

  if (ts.isTypeOperatorNode(typeNode)) {
    return collectTypeNames(typeNode.type, importContext);
  }

  return [];
}

function formatExpression(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function suggestionForBrands(brandNames: readonly string[]): string {
  if (brandNames.includes("UserId")) {
    return "Use `useOptionalUserId()` or add an auth/route/schema helper that returns `UserId` before the UI layer.";
  }

  if (
    brandNames.includes("IsoDate") ||
    brandNames.includes("IsoDateTime") ||
    brandNames.includes("Month")
  ) {
    return "Create the branded date/time in a boundary helper with `toIsoDate()`, `toIsoDateTime()`, `toMonth()`, or a route/schema decoder.";
  }

  if (brandNames.includes("CopAmount")) {
    return "Keep UI formatting numeric. Parse or validate the money value deeper in schema/data/repository code and pass the result into the component.";
  }

  if (brandNames.some((name) => name.endsWith("Id"))) {
    return "Move the ID proof into an allowed boundary: `require*` helper, schema/data/repository decoder, typed ID generator, or auth/route wrapper.";
  }

  return "Move the branded proof into an allowed boundary helper and pass the branded value into the UI instead of asserting locally.";
}

function inspectFile(
  rootDir: string,
  filePath: string,
  mobileRoot: string,
  brandedTypeNames: ReadonlySet<string>
): readonly Violation[] {
  const content = readFileSync(path.join(rootDir, filePath), "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const uiRule = getUiRule(filePath, mobileRoot);
  const importContext = collectBrandedImportContext(sourceFile, brandedTypeNames);

  if (uiRule == null) {
    return [];
  }

  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const typeNode = node.type;
      const brandNames = collectTypeNames(typeNode, importContext);

      if (brandNames.length > 0) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push({
          brandNames,
          filePath,
          line: position.line + 1,
          column: position.character + 1,
          expressionText: formatExpression(node.getText(sourceFile)),
          uiRule: uiRule.label,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return violations;
}

function formatViolation(violation: Violation): string {
  const brands = violation.brandNames.join(", ");
  return [
    `${violation.filePath}:${violation.line}:${violation.column}`,
    `  Illegal branded cast in UI path (${violation.uiRule}): ${brands}`,
    `  Found: ${violation.expressionText}`,
    "  Do instead:",
    `    - ${suggestionForBrands(violation.brandNames)}`,
    `    - Allowed boundaries: ${ALLOWED_BOUNDARY_HINTS.join(", ")}`,
  ].join("\n");
}

export function collectBrandedBoundaryViolations(
  options: BoundaryCheckOptions = {}
): readonly Violation[] {
  const rootDir = options.rootDir ?? process.cwd();
  const mobileRoot = options.mobileRoot ?? DEFAULT_MOBILE_ROOT;
  const brandedTypesFile = path.join(rootDir, mobileRoot, "shared/types/branded.ts");
  const brandedTypeNames = readBrandedTypeNames(brandedTypesFile);
  const files = listRepoFiles(path.join(rootDir, mobileRoot))
    .map((filePath) => normalizePath(rootDir, filePath))
    .filter((filePath) => isSourceFile(filePath) && !isTestFile(filePath));

  return files.flatMap((filePath) => inspectFile(rootDir, filePath, mobileRoot, brandedTypeNames));
}

export function formatBrandedBoundaryFailure(violations: readonly Violation[]): string {
  if (violations.length === 0) {
    return "";
  }

  return [
    "Branded boundary check failed.",
    "",
    "UI files must not create branded values with direct `as Brand` assertions. Move the proof into an approved boundary and pass the branded value in.",
    "",
    violations.map((violation) => formatViolation(violation)).join("\n\n"),
  ].join("\n");
}

function main(): void {
  const violations = collectBrandedBoundaryViolations();
  if (violations.length === 0) {
    return;
  }

  console.error(formatBrandedBoundaryFailure(violations));
  process.exitCode = 1;
}

if (import.meta.main) {
  main();
}
