#!/usr/bin/env bun

type Violation = {
  key: string;
  file: string;
  function: string;
  occurrence: number;
  cyclomaticComplexity: number;
  nloc: number;
  parameterCount: number;
};

type Ledger = {
  thresholds: {
    cyclomaticComplexity: number;
    nloc: number;
    parameterCount: number;
  };
  violations: Violation[];
};

const DEFAULT_THRESHOLDS = {
  cyclomaticComplexity: 5,
  nloc: 30,
  parameterCount: 3,
} as const;

const parseArgs = (argv: string[]) => {
  const csvIndex = argv.indexOf("--csv");
  const ledgerIndex = argv.indexOf("--ledger");
  const writeLedger = argv.includes("--write-ledger");

  if (csvIndex === -1 || ledgerIndex === -1 || !argv[csvIndex + 1] || !argv[ledgerIndex + 1]) {
    throw new Error(
      "Usage: bun scripts/check-lizard-complexity.ts --csv <path> --ledger <path> [--write-ledger]"
    );
  }

  return {
    csvPath: argv[csvIndex + 1],
    ledgerPath: argv[ledgerIndex + 1],
    writeLedger,
  };
};

const toRows = (csv: string): string[][] =>
  csv
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) ?? []);

const buildViolations = (rows: string[][]): Violation[] => {
  const occurrences = new Map<string, number>();

  return rows
    .map((row) => {
      const file = row[6]?.replaceAll('"', "") ?? "";
      const fn = row[7]?.replaceAll('"', "") ?? "";
      const occurrenceKey = `${file}::${fn}`;
      const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
      occurrences.set(occurrenceKey, occurrence);

      return {
        key: `${file}::${fn}::${occurrence}`,
        file,
        function: fn,
        occurrence,
        cyclomaticComplexity: Number(row[1]),
        nloc: Number(row[0]),
        parameterCount: Number(row[3]),
      };
    })
    .filter(
      (violation) =>
        violation.cyclomaticComplexity > DEFAULT_THRESHOLDS.cyclomaticComplexity ||
        violation.nloc > DEFAULT_THRESHOLDS.nloc ||
        violation.parameterCount > DEFAULT_THRESHOLDS.parameterCount
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
  const { csvPath, ledgerPath, writeLedger } = parseArgs(process.argv.slice(2));
  const csv = await Bun.file(csvPath).text();
  const currentViolations = buildViolations(toRows(csv));

  if (writeLedger) {
    const ledger: Ledger = {
      thresholds: { ...DEFAULT_THRESHOLDS },
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
