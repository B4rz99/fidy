#!/usr/bin/env bun

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type Args = {
  enforce: boolean;
  root: string;
  maxLines: number;
};

type Violation = {
  path: string;
  lineCount: number;
  category: string;
};

const DEFAULT_MAX_LINES = 300;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".context",
  ".git",
  ".next",
  ".expo",
  "build",
  "dist",
  "node_modules",
  ".worktrees",
]);

const normalizePath = (value: string): string => value.replaceAll("\\", "/");

const parseArgs = (argv: string[]): Args => {
  const enforce = argv.includes("--enforce");
  const rootIndex = argv.indexOf("--root");
  const maxLinesIndex = argv.indexOf("--max-lines");
  const root = rootIndex === -1 ? process.cwd() : argv[rootIndex + 1];
  const rawMaxLines = maxLinesIndex === -1 ? String(DEFAULT_MAX_LINES) : argv[maxLinesIndex + 1];
  const maxLines = Number(rawMaxLines);

  if (!root) {
    throw new Error("Missing value for --root");
  }

  if (!Number.isInteger(maxLines) || maxLines <= 0) {
    throw new Error("--max-lines must be a positive integer");
  }

  return { enforce, root, maxLines };
};

const hasSourceExtension = (relativePath: string): boolean =>
  [...SOURCE_EXTENSIONS].some((extension) => relativePath.endsWith(extension));

const isIgnoredFile = (relativePath: string): boolean => {
  return (
    relativePath.includes("/__tests__/") ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".test.tsx") ||
    relativePath.endsWith(".test.js") ||
    relativePath.endsWith(".test.jsx") ||
    relativePath.startsWith("apps/mobile/shared/i18n/locales/") ||
    relativePath === "apps/mobile/shared/db/schema.ts" ||
    relativePath.startsWith("apps/mobile/drizzle/") ||
    relativePath === "apps/mobile/app/_layout.tsx" ||
    /^supabase\/functions\/[^/]+\/index\.(ts|tsx|js|jsx)$/.test(relativePath) ||
    relativePath === "apps/mobile/eslint.config.js" ||
    relativePath === "scripts/check-branded-boundaries.ts"
  );
};

const listSourceFiles = (root: string, relativeDir = ""): string[] => {
  const absoluteDir = join(root, relativeDir);

  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name)
        ? []
        : listSourceFiles(root, join(relativeDir, entry.name));
    }

    const entryPath = normalizePath(join(relativeDir, entry.name));
    return hasSourceExtension(entryPath) && !isIgnoredFile(entryPath) ? [entryPath] : [];
  });
};

const countLines = (contents: string): number =>
  contents.length === 0
    ? 0
    : (contents.match(/\n/g)?.length ?? 0) + (contents.endsWith("\n") ? 0 : 1);

const categorizeViolation = (relativePath: string): string => {
  if (relativePath.includes("/components/")) return "components";
  if (relativePath.endsWith("/store.ts")) return "stores";
  if (relativePath.includes("/services/")) return "services";
  if (relativePath.includes("/lib/")) return "lib";
  if (relativePath.includes("/app/")) return "app";
  if (relativePath === "apps/mobile/shared/db/schema.ts") return "schema";
  if (relativePath.startsWith("supabase/functions/")) return "edge-functions";
  return "other/tooling";
};

const scanViolations = (root: string, maxLines: number): Violation[] =>
  listSourceFiles(root)
    .map((filePath) => {
      const lineCount = countLines(readFileSync(join(root, filePath), "utf8"));
      return {
        path: filePath,
        lineCount,
        category: categorizeViolation(filePath),
      };
    })
    .filter((violation) => violation.lineCount > maxLines)
    .sort((left, right) => right.lineCount - left.lineCount || left.path.localeCompare(right.path));

const summarizeByCategory = (violations: readonly Violation[]): Array<[string, number]> => {
  const counts = violations.reduce<Map<string, number>>((nextCounts, violation) => {
    nextCounts.set(violation.category, (nextCounts.get(violation.category) ?? 0) + 1);
    return nextCounts;
  }, new Map());

  return [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]));
};

const formatReport = (root: string, maxLines: number, violations: readonly Violation[]): string => {
  const categorySummary = summarizeByCategory(violations)
    .map(([category, count]) => `${category}: ${count}`)
    .join("\n");
  const filesSection = violations
    .map((violation) => `${violation.lineCount} ${violation.path} [${violation.category}]`)
    .join("\n");
  const splitGuidance = "File is too long. Split by responsibility boundary, not arbitrary chunks.";

  return [
    `Root: ${normalizePath(relative(process.cwd(), root) || ".")}`,
    `Max lines: ${maxLines}`,
    `Oversized files: ${violations.length}`,
    violations.length > 0 ? splitGuidance : "",
    violations.length > 0 ? "" : "No oversized files found.",
    violations.length > 0 ? "By category:" : "",
    violations.length > 0 ? categorySummary : "",
    violations.length > 0 ? "" : "",
    violations.length > 0 ? "Files:" : "",
    violations.length > 0 ? filesSection : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
};

const main = () => {
  const { enforce, root, maxLines } = parseArgs(process.argv.slice(2));
  const violations = scanViolations(root, maxLines);
  console.log(formatReport(root, maxLines, violations));

  if (enforce && violations.length > 0) {
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
