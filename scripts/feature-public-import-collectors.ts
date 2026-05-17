import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type ImportViolation = {
  readonly importer: string;
  readonly importedFeature: string;
  readonly line: number;
};

export type PathImportViolation = {
  readonly importer: string;
  readonly importedPath: string;
  readonly line: number;
};

export type NamedImportViolation = {
  readonly importer: string;
  readonly importedName: string;
  readonly importedPath: string;
  readonly line: number;
};

const FEATURES_ROOT = join("apps", "mobile", "features");
const LOCAL_LEDGER_ROOT = join("apps", "mobile", "local-ledger");
const TEST_FILE_PATTERN = /\.test\.(ts|tsx)$/;
const FEATURE_IMPORT_PATTERN = String.raw`(?:^|\n)\s*(?:import|export)(?:\s+type)?[^;]*?\bfrom\s+["']@\/features\/([^/"']+)["']`;
const ANY_FEATURE_IMPORT_PATTERN = String.raw`(?:^|\n)\s*(?:import|export)(?:\s+type)?[^;]*?\bfrom\s+["']@\/features\/([^/"']+)(?:\/[^"']*)?["']`;
const RAW_LOCAL_LEDGER_INFRA_IMPORT_PATTERN = String.raw`(?:^|\n)\s*(?:import|export)(?:\s+type)?[^;]*?\bfrom\s+["'](@\/infrastructure\/local-ledger\/(?!public["'])[^"']+)["']`;
const LOCAL_LEDGER_INFRA_PUBLIC_IMPORT_PATTERN = String.raw`(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?\{([^;]*?)\}\s+from\s+["'](@\/infrastructure\/local-ledger\/public)["']`;
const UNSAFE_LOCAL_LEDGER_INFRA_PUBLIC_EXPORTS = new Set([
  "insertTransactionStorageRow",
  "markTransactionSupersededStorageRow",
  "upsertTransactionStorageRow",
  "upsertTransferStorageRow",
]);

const normalizePath = (path: string): string => path.replaceAll("\\", "/");
const isTsSourceFile = (path: string) => {
  const extension = extname(path);
  return extension === ".ts" || extension === ".tsx";
};
const isIgnoredSourceFile = (path: string) =>
  path.includes(`${join("apps", "mobile", "__tests__")}${join("", "")}`) ||
  path.includes(`${join("features", "__tests__")}${join("", "")}`) ||
  path.includes(`${join("", "__tests__")}`) ||
  TEST_FILE_PATTERN.test(path);

const walk = (root: string): readonly string[] => {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = join(root, entry);
    const entryStats = statSync(absolutePath);
    return entryStats.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
};

export const extractOwnerFeatureFromPath = (path: string): string | null => {
  const normalized = normalizePath(path);
  const match = normalized.match(/apps\/mobile\/features\/([^/]+)/);
  return match?.[1] ?? null;
};

const countNewlines = (text: string): number => text.split("\n").length - 1;
const getDeclarationOffset = (match: RegExpMatchArray): number | null => {
  const declarationOffset = match[0].search(/\b(?:import|export)\b/);
  return declarationOffset === -1 ? null : declarationOffset;
};

const collectImportsMatchingPattern = (
  source: string,
  pattern: string
): readonly { readonly importedFeature: string; readonly line: number }[] =>
  Array.from(source.matchAll(new RegExp(pattern, "g"))).flatMap((match) => {
    const importedFeature = match[1];
    const matchIndex = match.index;
    const declarationOffset = getDeclarationOffset(match);
    if (importedFeature == null || matchIndex == null || declarationOffset == null) return [];

    return [
      {
        importedFeature,
        line: countNewlines(source.slice(0, matchIndex + declarationOffset)) + 1,
      },
    ];
  });

const collectFeatureImports = (
  source: string
): readonly { readonly importedFeature: string; readonly line: number }[] =>
  collectImportsMatchingPattern(source, FEATURE_IMPORT_PATTERN);

const collectAnyFeatureImports = (
  source: string
): readonly { readonly importedFeature: string; readonly line: number }[] =>
  collectImportsMatchingPattern(source, ANY_FEATURE_IMPORT_PATTERN);

const collectRawLocalLedgerInfrastructureImports = (
  source: string
): readonly { readonly importedPath: string; readonly line: number }[] =>
  Array.from(source.matchAll(new RegExp(RAW_LOCAL_LEDGER_INFRA_IMPORT_PATTERN, "g"))).flatMap(
    (match) => {
      const importedPath = match[1];
      const matchIndex = match.index;
      const declarationOffset = getDeclarationOffset(match);
      if (importedPath == null || matchIndex == null || declarationOffset == null) return [];
      return [
        {
          importedPath,
          line: countNewlines(source.slice(0, matchIndex + declarationOffset)) + 1,
        },
      ];
    }
  );

const normalizeImportedName = (name: string): string => name.trim().split(/\s+as\s+/u)[0] ?? "";

const collectUnsafeLocalLedgerInfrastructurePublicImports = (
  source: string
): readonly NamedImportViolation[] =>
  Array.from(source.matchAll(new RegExp(LOCAL_LEDGER_INFRA_PUBLIC_IMPORT_PATTERN, "g"))).flatMap(
    (match) => {
      const importList = match[1];
      const importedPath = match[2];
      const matchIndex = match.index;
      const declarationOffset = getDeclarationOffset(match);
      if (
        importList == null ||
        importedPath == null ||
        matchIndex == null ||
        declarationOffset == null
      ) {
        return [];
      }

      const line = countNewlines(source.slice(0, matchIndex + declarationOffset)) + 1;
      return importList
        .split(",")
        .map(normalizeImportedName)
        .filter((importedName) => UNSAFE_LOCAL_LEDGER_INFRA_PUBLIC_EXPORTS.has(importedName))
        .map((importedName) => ({ importer: "", importedName, importedPath, line }));
    }
  );

export const collectFeaturePublicImportViolations = (root: string): readonly ImportViolation[] =>
  walk(join(root, FEATURES_ROOT))
    .filter(isTsSourceFile)
    .filter((path) => !isIgnoredSourceFile(path))
    .flatMap((path) => {
      const ownerFeature = extractOwnerFeatureFromPath(path);
      if (ownerFeature == null) return [];

      const source = readFileSync(path, "utf8");
      return collectFeatureImports(source)
        .filter((importedFeature) => importedFeature.importedFeature !== ownerFeature)
        .map((importedFeature) => ({
          importer: normalizePath(relative(root, path)),
          importedFeature: importedFeature.importedFeature,
          line: importedFeature.line,
        }));
    });

export const collectLocalLedgerFeatureImportViolations = (
  root: string
): readonly ImportViolation[] =>
  walk(join(root, LOCAL_LEDGER_ROOT))
    .filter(isTsSourceFile)
    .filter((path) => !isIgnoredSourceFile(path))
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return collectAnyFeatureImports(source).map((importedFeature) => ({
        importer: normalizePath(relative(root, path)),
        importedFeature: importedFeature.importedFeature,
        line: importedFeature.line,
      }));
    });

export const collectFeatureRawLocalLedgerInfrastructureImportViolations = (
  root: string
): readonly PathImportViolation[] =>
  walk(join(root, FEATURES_ROOT))
    .filter(isTsSourceFile)
    .filter((path) => !isIgnoredSourceFile(path))
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return collectRawLocalLedgerInfrastructureImports(source).map((imported) => ({
        importer: normalizePath(relative(root, path)),
        importedPath: imported.importedPath,
        line: imported.line,
      }));
    });

export const collectFeatureUnsafeLocalLedgerInfrastructurePublicImportViolations = (
  root: string
): readonly NamedImportViolation[] =>
  walk(join(root, FEATURES_ROOT))
    .filter(isTsSourceFile)
    .filter((path) => !isIgnoredSourceFile(path))
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return collectUnsafeLocalLedgerInfrastructurePublicImports(source).map((imported) => ({
        importer: normalizePath(relative(root, path)),
        importedName: imported.importedName,
        importedPath: imported.importedPath,
        line: imported.line,
      }));
    });
