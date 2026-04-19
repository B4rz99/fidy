#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const MOBILE_ROOT = "apps/mobile";
const BRANDED_TYPES_FILE = path.join(ROOT, MOBILE_ROOT, "shared/types/branded.ts");

const UI_PATH_RULES = [
  {
    label: "app/**",
    matches: (filePath: string) => filePath.startsWith("apps/mobile/app/"),
  },
  {
    label: "features/**/components/**",
    matches: (filePath: string) => /^apps\/mobile\/features\/.+\/components\//.test(filePath),
  },
  {
    label: "shared/components/**",
    matches: (filePath: string) => filePath.startsWith("apps/mobile/shared/components/"),
  },
] as const;

const ALLOWED_BOUNDARY_HINTS = [
  "apps/mobile/shared/types/assertions.ts",
  "apps/mobile/shared/lib/format-date.ts",
  "apps/mobile/shared/lib/generate-id.ts",
  "apps/mobile/**/schema.ts",
  "apps/mobile/**/data/**",
  "apps/mobile/**/repository/**",
  "apps/mobile/features/auth/public.ts",
];

type Violation = {
  readonly brandNames: readonly string[];
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly expressionText: string;
  readonly uiRule: (typeof UI_PATH_RULES)[number]["label"];
};

function listRepoFiles(dirPath: string): readonly string[] {
  return readdirSync(dirPath).flatMap((entry) => {
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

function normalizePath(filePath: string): string {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function getUiRule(filePath: string): (typeof UI_PATH_RULES)[number] | null {
  return UI_PATH_RULES.find((rule) => rule.matches(filePath)) ?? null;
}

function isSourceFile(filePath: string): boolean {
  return /\.(ts|tsx)$/.test(filePath);
}

function isTestFile(filePath: string): boolean {
  return filePath.includes("/__tests__/") || /\.test\.(ts|tsx)$/.test(filePath);
}

function collectTypeNames(typeNode: ts.TypeNode): readonly string[] {
  if (ts.isTypeReferenceNode(typeNode)) {
    return [typeNode.typeName.getText()];
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectTypeNames(typeNode.type);
  }

  if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
    return typeNode.types.flatMap((part) => collectTypeNames(part));
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return collectTypeNames(typeNode.elementType);
  }

  if (ts.isTypeOperatorNode(typeNode)) {
    return collectTypeNames(typeNode.type);
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
  filePath: string,
  brandedTypeNames: ReadonlySet<string>
): readonly Violation[] {
  const content = readFileSync(path.join(ROOT, filePath), "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const uiRule = getUiRule(filePath);

  if (uiRule == null) {
    return [];
  }

  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const typeNode = node.type;
      const brandNames = collectTypeNames(typeNode).filter((name) => brandedTypeNames.has(name));

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

function main(): void {
  const brandedTypeNames = readBrandedTypeNames(BRANDED_TYPES_FILE);
  const files = listRepoFiles(path.join(ROOT, MOBILE_ROOT))
    .map((filePath) => normalizePath(filePath))
    .filter((filePath) => isSourceFile(filePath) && !isTestFile(filePath));

  const violations = files.flatMap((filePath) => inspectFile(filePath, brandedTypeNames));

  if (violations.length === 0) {
    return;
  }

  console.error("Branded boundary check failed.\n");
  console.error(
    "UI files must not create branded values with direct `as Brand` assertions. Move the proof into an approved boundary and pass the branded value in.\n"
  );
  console.error(violations.map((violation) => formatViolation(violation)).join("\n\n"));
  process.exitCode = 1;
}

main();
