import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

type CliOptions = {
  readonly baselinePath: string;
  readonly enforce: boolean;
  readonly root: string;
  readonly writeBaseline: boolean;
};

type ColorLiteral = {
  readonly file: string;
  readonly line: number;
  readonly literal: string;
  readonly source: string;
};

const DEFAULT_ROOT = process.cwd();
const DEFAULT_BASELINE_PATH = join("scripts", "theme-color-literals-baseline.json");
const SOURCE_ROOTS = [
  join("apps", "mobile", "app"),
  join("apps", "mobile", "features"),
  join("apps", "mobile", "shared"),
];
const COLOR_LITERAL_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\([^\n)]*\)/g;
const IGNORED_PATH_PARTS = ["/__tests__/", "/migrations/"];
const ALLOWED_FILES = new Set([
  normalizePath(join("apps", "mobile", "shared", "constants", "theme.ts")),
]);

const withOptions = (options: CliOptions, patch: Partial<CliOptions>): CliOptions =>
  Object.assign({}, options, patch);

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

const isTsSourceFile = (path: string): boolean => {
  const extension = extname(path);
  return extension === ".ts" || extension === ".tsx";
};

const shouldIgnoreFile = (root: string, path: string): boolean => {
  const relativePath = normalizePath(relative(root, path));
  return (
    ALLOWED_FILES.has(relativePath) ||
    IGNORED_PATH_PARTS.some((part) => normalizePath(path).includes(part))
  );
};

const walk = (root: string): readonly string[] => {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = join(root, entry);
    const entryStats = statSync(absolutePath);
    return entryStats.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
};

const toSignature = (literal: ColorLiteral): string =>
  `${literal.file}\t${literal.literal}\t${literal.source}`;

export const collectThemeColorLiterals = (root: string): readonly ColorLiteral[] =>
  SOURCE_ROOTS.flatMap((sourceRoot) => walk(join(root, sourceRoot)))
    .filter(isTsSourceFile)
    .filter((path) => !shouldIgnoreFile(root, path))
    .flatMap((path) => {
      const relativePath = normalizePath(relative(root, path));
      const lines = readFileSync(path, "utf8").split("\n");
      return lines.flatMap((source, index) =>
        Array.from(source.matchAll(COLOR_LITERAL_PATTERN)).map((match) => ({
          file: relativePath,
          line: index + 1,
          literal: match[0],
          source: source.trim(),
        }))
      );
    });

const parseArgs = (argv: readonly string[]): CliOptions =>
  argv.reduce<CliOptions>(
    (options, arg, index, allArgs) => {
      if (arg === "--enforce") return withOptions(options, { enforce: true });
      if (arg === "--write-baseline") return withOptions(options, { writeBaseline: true });
      if (arg === "--root") {
        const root = allArgs[index + 1];
        return root ? withOptions(options, { root }) : options;
      }
      if (arg === "--baseline") {
        const baselinePath = allArgs[index + 1];
        return baselinePath ? withOptions(options, { baselinePath }) : options;
      }
      return options;
    },
    {
      baselinePath: DEFAULT_BASELINE_PATH,
      enforce: false,
      root: DEFAULT_ROOT,
      writeBaseline: false,
    }
  );

const readBaseline = (path: string): ReadonlySet<string> => {
  if (!existsSync(path)) return new Set();
  const parsed = JSON.parse(readFileSync(path, "utf8")) as readonly string[];
  return new Set(parsed);
};

const writeBaseline = (path: string, literals: readonly ColorLiteral[]): void => {
  mkdirSync(dirname(path), { recursive: true });
  const signatures = Array.from(new Set(literals.map(toSignature))).sort();
  writeFileSync(path, `${JSON.stringify(signatures, null, 2)}\n`);
};

const formatLiteral = (literal: ColorLiteral): string =>
  `${literal.file}:${literal.line} uses ${literal.literal}`;

const report = (literals: readonly ColorLiteral[], newLiterals: readonly ColorLiteral[]): void => {
  console.log(`Hardcoded theme color literals: ${literals.length}`);
  console.log(`New hardcoded theme color literals: ${newLiterals.length}`);
  newLiterals
    .slice()
    .sort((left, right) => formatLiteral(left).localeCompare(formatLiteral(right)))
    .forEach((literal) => {
      console.log(`- ${formatLiteral(literal)}`);
    });
};

const main = (argv: readonly string[]): number => {
  const options = parseArgs(argv);
  const baselinePath = join(options.root, options.baselinePath);
  const literals = collectThemeColorLiterals(options.root);

  if (options.writeBaseline) {
    writeBaseline(baselinePath, literals);
    console.log(`Wrote theme color literal baseline to ${options.baselinePath}`);
    console.log(`Baseline hardcoded theme color literals: ${literals.length}`);
    return 0;
  }

  const baseline = readBaseline(baselinePath);
  const newLiterals = literals.filter((literal) => !baseline.has(toSignature(literal)));
  report(literals, newLiterals);
  return options.enforce && newLiterals.length > 0 ? 1 : 0;
};

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
