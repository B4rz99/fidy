#!/usr/bin/env bun

type Violation = {
  key: string;
  file: string;
  function: string;
  thresholdProfile: ThresholdProfileName;
  cyclomaticComplexity: number;
  nloc: number;
  parameterCount: number;
};

type Thresholds = {
  cyclomaticComplexity: number;
  nloc: number;
  parameterCount: number;
};

type ThresholdProfileName = "lib" | "default";

type Ledger = {
  thresholds: typeof THRESHOLD_PROFILES;
  violations: Violation[];
};

const THRESHOLD_PROFILES = {
  lib: {
    cyclomaticComplexity: 5,
    nloc: 30,
    parameterCount: 3,
  },
  default: {
    cyclomaticComplexity: 8,
    nloc: 50,
    parameterCount: 4,
  },
} as const;

const LIB_PATH_PATTERN = /(^|\/)lib(\/|$)/;

const thresholdProfileForFile = (file: string): ThresholdProfileName =>
  LIB_PATH_PATTERN.test(file) ? "lib" : "default";

const exceedsThresholds = (violation: Violation, thresholds: Thresholds): boolean =>
  violation.cyclomaticComplexity > thresholds.cyclomaticComplexity ||
  violation.nloc > thresholds.nloc ||
  violation.parameterCount > thresholds.parameterCount;

const parseArgs = (argv: string[]) => {
  const csvIndex = argv.indexOf("--csv");
  const ledgerIndex = argv.indexOf("--ledger");
  const writeLedger = argv.includes("--write-ledger");
  const allowNonZeroWrite = argv.includes("--allow-nonzero-write");

  if (csvIndex === -1 || ledgerIndex === -1 || !argv[csvIndex + 1] || !argv[ledgerIndex + 1]) {
    throw new Error(
      "Usage: bun scripts/check-lizard-complexity.ts --csv <path> --ledger <path> [--write-ledger] [--allow-nonzero-write]"
    );
  }

  return {
    csvPath: argv[csvIndex + 1],
    ledgerPath: argv[ledgerIndex + 1],
    writeLedger,
    allowNonZeroWrite,
  };
};

const toRows = (csv: string): string[][] =>
  csv
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) ?? []);

const stripQuotes = (value: string | undefined): string => value?.replaceAll('"', "") ?? "";

const buildViolations = (rows: string[][]): Violation[] => {
  return rows
    .map((row) => {
      const key = stripQuotes(row[5]);
      const file = stripQuotes(row[6]);
      const fn = stripQuotes(row[7]);
      const thresholdProfile = thresholdProfileForFile(file);

      return {
        key,
        file,
        function: fn,
        thresholdProfile,
        cyclomaticComplexity: Number(row[1]),
        nloc: Number(row[0]),
        parameterCount: Number(row[3]),
      };
    })
    .filter((violation) =>
      exceedsThresholds(violation, THRESHOLD_PROFILES[violation.thresholdProfile])
    );
};

const findNewViolations = (
  currentViolations: Violation[],
  ledgerViolations: Violation[]
): Violation[] => {
  const ledgerKeys = new Set(ledgerViolations.map((violation) => violation.key));
  return currentViolations.filter((violation) => !ledgerKeys.has(violation.key));
};

const findWorsenedViolations = (
  currentViolations: Violation[],
  ledgerViolations: Violation[]
): Array<{ current: Violation; ledger: Violation }> => {
  const ledgerByKey = new Map(ledgerViolations.map((violation) => [violation.key, violation]));

  return currentViolations.flatMap((violation) => {
    const ledgerViolation = ledgerByKey.get(violation.key);
    if (!ledgerViolation) {
      return [];
    }

    const isWorse =
      violation.cyclomaticComplexity > ledgerViolation.cyclomaticComplexity ||
      violation.nloc > ledgerViolation.nloc ||
      violation.parameterCount > ledgerViolation.parameterCount;

    return isWorse ? [{ current: violation, ledger: ledgerViolation }] : [];
  });
};

const main = async () => {
  const { csvPath, ledgerPath, writeLedger, allowNonZeroWrite } = parseArgs(process.argv.slice(2));
  const csv = await Bun.file(csvPath).text();
  const currentViolations = buildViolations(toRows(csv));

  if (writeLedger) {
    if (currentViolations.length > 0 && !allowNonZeroWrite) {
      throw new Error(
        "Refusing to write a non-zero Lizard baseline. Fix the violations or rerun intentionally with --allow-nonzero-write."
      );
    }

    const ledger: Ledger = {
      thresholds: { ...THRESHOLD_PROFILES },
      violations: [...currentViolations].sort((left, right) => left.key.localeCompare(right.key)),
    };

    await Bun.write(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    return;
  }

  const ledger = (await Bun.file(ledgerPath).json()) as Ledger;
  const newViolations = findNewViolations(currentViolations, ledger.violations);
  const worsenedViolations = findWorsenedViolations(currentViolations, ledger.violations);

  if (newViolations.length > 0) {
    throw new Error(
      `Found new strict Lizard violations: ${newViolations.map((violation) => violation.key).join(", ")}`
    );
  }

  if (worsenedViolations.length > 0) {
    throw new Error(
      `Found worse strict Lizard violations: ${worsenedViolations
        .map(({ current }) => current.key)
        .join(", ")}`
    );
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
