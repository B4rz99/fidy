import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

type Violation = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

const SOURCE_ROOTS = [join("apps", "mobile", "app"), join("apps", "mobile", "features")];

const DIRECT_SOLID_SURFACE_ALLOWLIST = new Set([
  normalizePath(join("apps", "mobile", "features", "ai-chat", "components", "ChatInput.tsx")),
  normalizePath(join("apps", "mobile", "features", "calendar", "components", "CalendarGrid.tsx")),
  normalizePath(
    join("apps", "mobile", "features", "capture-sources", "components", "ApplePaySetupCard.tsx")
  ),
  normalizePath(join("apps", "mobile", "features", "design-system", "ui.public.tsx")),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "financial-accounts",
      "components",
      "financial-account-details-screen",
      "FinancialAccountDetailsHero.tsx"
    )
  ),
  normalizePath(join("apps", "mobile", "features", "goals", "components", "CelebrationModal.tsx")),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "goals",
      "components",
      "goal-detail",
      "GoalDetailAiPlanTab.tsx"
    )
  ),
  normalizePath(
    join("apps", "mobile", "features", "onboarding", "components", "ConnectEmailStep.tsx")
  ),
  normalizePath(
    join("apps", "mobile", "features", "qa", "components", "qa-tools", "QaToolsContent.tsx")
  ),
  normalizePath(join("apps", "mobile", "features", "search", "components", "ResultsSummary.tsx")),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "search",
      "components",
      "search-screen",
      "SearchFilterControls.tsx"
    )
  ),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "search",
      "components",
      "search-screen",
      "SearchTransactionItem.tsx"
    )
  ),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "transactions",
      "components",
      "transaction-form",
      "TransactionMetadataRow.tsx"
    )
  ),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "transfers",
      "components",
      "transfer-form",
      "TransferFormContent.tsx"
    )
  ),
]);

const SURFACE_LAYOUT_ALLOWLIST = new Set([
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "account-suggestions",
      "components",
      "CreateSuggestedAccountScreen.tsx"
    )
  ),
  normalizePath(join("apps", "mobile", "features", "auth", "components", "OAuthButton.tsx")),
  normalizePath(
    join(
      "apps",
      "mobile",
      "features",
      "financial-accounts",
      "components",
      "financial-account-form",
      "FinancialAccountFormFields.tsx"
    )
  ),
  normalizePath(
    join("apps", "mobile", "features", "qa", "components", "qa-tools", "QaToolsCardButton.tsx")
  ),
]);

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function walk(root: string): readonly string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = join(root, entry);
    const entryStats = statSync(absolutePath);
    return entryStats.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

function isTsSourceFile(path: string): boolean {
  const extension = extname(path);
  return extension === ".ts" || extension === ".tsx";
}

function toLine(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function collectPatternViolations(input: {
  readonly file: string;
  readonly message: string;
  readonly pattern: RegExp;
  readonly source: string;
}): readonly Violation[] {
  return Array.from(input.source.matchAll(input.pattern)).map((match) => ({
    file: input.file,
    line: toLine(input.source, match.index ?? 0),
    message: input.message,
  }));
}

function collectFileViolations(root: string, path: string): readonly Violation[] {
  const file = normalizePath(relative(root, path));
  const source = readFileSync(path, "utf8");
  const violations: Violation[] = [];
  const directSolidSurfaceMatch =
    source.match(
      /import\s+\{[^}]*\bSolidSurface\b[^}]*\}\s+from\s+["']@\/shared\/components["']/
    ) ??
    source.match(/from\s+["']@\/shared\/components\/SolidSurface["']/) ??
    source.match(/<SolidSurface\b/);

  if (directSolidSurfaceMatch && !DIRECT_SOLID_SURFACE_ALLOWLIST.has(file)) {
    violations.push({
      file,
      line: toLine(source, directSolidSurfaceMatch.index ?? 0),
      message:
        "Feature/app code should use Card, FieldSurface, ListRowSurface, Dialog, Picker, or a new shared primitive instead of direct SolidSurface.",
    });
  }

  if (source.includes("surfaceLayoutStyle=") && !SURFACE_LAYOUT_ALLOWLIST.has(file)) {
    violations.push({
      file,
      line: toLine(source, source.indexOf("surfaceLayoutStyle=")),
      message:
        "Feature/app code should not pass surfaceLayoutStyle unless explicitly allowlisted; add a named primitive prop instead.",
    });
  }

  return [
    ...violations,
    ...collectPatternViolations({
      file,
      source,
      pattern: /\bsurfaceStyle\s*=/g,
      message:
        "surfaceStyle is no longer a feature/app escape hatch; use named visual props or layout-only primitive props.",
    }),
    ...collectPatternViolations({
      file,
      source,
      pattern:
        /\bclassName\s*=\s*(?:"[^"]*\bbg-(?:card|surface)\b[^"]*"|`[^`]*\bbg-(?:card|surface)\b[^`]*`)/g,
      message:
        "Feature/app code should not use bg-card/bg-surface directly; use shared surface primitives.",
    }),
    ...collectPatternViolations({
      file,
      source,
      pattern:
        /from\s+["']@\/shared\/components\/ScreenShell["']|import\s+\{[^}]*\bScreenShell\b[^}]*\}\s+from\s+["']@\/shared\/components["']/g,
      message:
        "Feature/app code should use ScreenLayout, FormScreen, or MoneyEntryScreen instead of composing ScreenShell directly.",
    }),
  ];
}

function main(): number {
  const root = process.cwd();
  const violations = SOURCE_ROOTS.flatMap((sourceRoot) => walk(join(root, sourceRoot)))
    .filter(isTsSourceFile)
    .flatMap((path) => collectFileViolations(root, path));

  if (violations.length === 0) {
    console.log("Mobile UI architecture guard: no violations found.");
    return 0;
  }

  console.error("Mobile UI architecture guard failed:");
  violations.forEach((violation) => {
    console.error(`- ${violation.file}:${violation.line} ${violation.message}`);
  });
  return 1;
}

if (import.meta.main) {
  process.exit(main());
}
