import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

type CliOptions = {
  readonly enforce: boolean;
  readonly root: string;
};

type ImportViolation = {
  readonly importer: string;
  readonly importedFeature: string;
  readonly line: number;
};

const DEFAULT_ROOT = process.cwd();
const FEATURES_ROOT = join("apps", "mobile", "features");
const TEST_FILE_PATTERN = /\.test\.(ts|tsx)$/;
const FEATURE_IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)(?:\s+type)?[\s\S]*?\bfrom\s+["']@\/features\/([^/"']+)["']/g;
const withOptions = (options: CliOptions, patch: Partial<CliOptions>): CliOptions => ({
  ...options,
  ...patch,
});
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

const collectFeatureImports = (
  source: string
): readonly { readonly importedFeature: string; readonly line: number }[] =>
  Array.from(source.matchAll(FEATURE_IMPORT_PATTERN)).flatMap((match) => {
    const importedFeature = match[1];
    const matchIndex = match.index;
    const declarationOffset = getDeclarationOffset(match);
    if (importedFeature == null || matchIndex == null || declarationOffset == null) {
      return [];
    }

    return [
      {
        importedFeature,
        line: countNewlines(source.slice(0, matchIndex + declarationOffset)) + 1,
      },
    ];
  });

export const collectFeaturePublicImportViolations = (root: string): readonly ImportViolation[] => {
  const featuresRoot = join(root, FEATURES_ROOT);

  return walk(featuresRoot)
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
};

const parseArgs = (argv: readonly string[]): CliOptions =>
  argv.reduce<CliOptions>(
    (options, arg, index, allArgs) => {
      if (arg === "--enforce") {
        return withOptions(options, { enforce: true });
      }

      if (arg === "--root") {
        const root = allArgs[index + 1];
        return root ? withOptions(options, { root }) : options;
      }

      return options;
    },
    { enforce: false, root: DEFAULT_ROOT }
  );

const formatViolation = (violation: ImportViolation): string =>
  `${violation.importer}:${violation.line} imports @/features/${violation.importedFeature}`;

const reportViolations = (violations: readonly ImportViolation[]): void => {
  const total = violations.length;
  console.log(`Broad cross-feature barrel imports: ${total}`);

  if (total === 0) {
    console.log("No broad cross-feature barrel imports found.");
    return;
  }

  violations
    .slice()
    .sort((left, right) => formatViolation(left).localeCompare(formatViolation(right)))
    .forEach((violation) => {
      console.log(`- ${formatViolation(violation)}`);
    });
};

const main = (argv: readonly string[]): number => {
  const options = parseArgs(argv);
  const violations = collectFeaturePublicImportViolations(options.root);
  reportViolations(violations);

  return options.enforce && violations.length > 0 ? 1 : 0;
};

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
