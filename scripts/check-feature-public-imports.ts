import {
  collectFeaturePublicImportViolations,
  collectFeatureRawLocalLedgerInfrastructureImportViolations,
  collectFeatureUnsafeLocalLedgerInfrastructurePublicImportViolations,
  collectLocalLedgerFeatureImportViolations,
  extractOwnerFeatureFromPath,
  type ImportViolation,
  type NamedImportViolation,
  type PathImportViolation,
} from "./feature-public-import-collectors";

export {
  collectFeaturePublicImportViolations,
  collectFeatureRawLocalLedgerInfrastructureImportViolations,
  collectFeatureUnsafeLocalLedgerInfrastructurePublicImportViolations,
  collectLocalLedgerFeatureImportViolations,
  extractOwnerFeatureFromPath,
};

type CliOptions = {
  readonly enforce: boolean;
  readonly root: string;
};

const DEFAULT_ROOT = process.cwd();
const withOptions = (options: CliOptions, patch: Partial<CliOptions>): CliOptions => ({
  ...options,
  ...patch,
});

const parseArgs = (argv: readonly string[]): CliOptions =>
  argv.reduce<CliOptions>(
    (options, arg, index, allArgs) => {
      if (arg === "--enforce") return withOptions(options, { enforce: true });
      if (arg !== "--root") return options;

      const root = allArgs[index + 1];
      if (root == null || root.startsWith("-")) {
        throw new Error("--root requires a path value");
      }
      return withOptions(options, { root });
    },
    { enforce: false, root: DEFAULT_ROOT }
  );

const formatViolation = (violation: ImportViolation): string =>
  `${violation.importer}:${violation.line} imports @/features/${violation.importedFeature}`;

const formatPathViolation = (violation: PathImportViolation): string =>
  `${violation.importer}:${violation.line} imports ${violation.importedPath}`;

const formatNamedViolation = (violation: NamedImportViolation): string =>
  `${violation.importer}:${violation.line} imports ${violation.importedName} from ${violation.importedPath}`;

const report = <T>(
  violations: readonly T[],
  label: string,
  emptyMessage: string,
  format: (violation: T) => string
): void => {
  console.log(`${label}: ${violations.length}`);

  if (violations.length === 0) {
    console.log(emptyMessage);
    return;
  }

  violations
    .slice()
    .sort((left, right) => format(left).localeCompare(format(right)))
    .forEach((violation) => {
      console.log(`- ${format(violation)}`);
    });
};

const main = (argv: readonly string[]): number => {
  const options = parseArgs(argv);
  const featureImportViolations = collectFeaturePublicImportViolations(options.root);
  const localLedgerImportViolations = collectLocalLedgerFeatureImportViolations(options.root);
  const rawInfraImportViolations = collectFeatureRawLocalLedgerInfrastructureImportViolations(
    options.root
  );
  const unsafeInfraPublicImportViolations =
    collectFeatureUnsafeLocalLedgerInfrastructurePublicImportViolations(options.root);

  report(
    featureImportViolations,
    "Broad cross-feature barrel imports",
    "No broad cross-feature barrel imports found.",
    formatViolation
  );
  report(
    localLedgerImportViolations,
    "Local Ledger feature imports",
    "No Local Ledger feature imports found.",
    formatViolation
  );
  report(
    rawInfraImportViolations,
    "Feature raw Local Ledger infrastructure imports",
    "No feature raw Local Ledger infrastructure imports found.",
    formatPathViolation
  );
  report(
    unsafeInfraPublicImportViolations,
    "Feature unsafe Local Ledger infrastructure public imports",
    "No feature unsafe Local Ledger infrastructure public imports found.",
    formatNamedViolation
  );

  const hasViolations =
    featureImportViolations.length > 0 ||
    localLedgerImportViolations.length > 0 ||
    rawInfraImportViolations.length > 0 ||
    unsafeInfraPublicImportViolations.length > 0;
  return options.enforce && hasViolations ? 1 : 0;
};

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
