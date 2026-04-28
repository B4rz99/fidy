import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "lizard-complexity-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    rmSync(dir, { recursive: true, force: true });
  });
});

test("passes when current strict violations match the checked-in ledger", () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    '31,6,100,2,31,"alpha@10-40@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",10,40\n'
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: {
        lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
        default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
      },
      violations: [
        {
          key: "alpha@10-40@apps/mobile/shared/lib/foo.ts",
          file: "apps/mobile/shared/lib/foo.ts",
          function: "alpha",
          thresholdProfile: "lib",
          cyclomaticComplexity: 6,
          nloc: 31,
          parameterCount: 2,
        },
      ],
    })
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-lizard-complexity.ts", "--csv", csvPath, "--ledger", ledgerPath],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(0);
});

test("fails when an existing strict violation gets worse", () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    '31,7,100,2,31,"alpha@10-40@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",10,40\n'
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: {
        lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
        default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
      },
      violations: [
        {
          key: "alpha@10-40@apps/mobile/shared/lib/foo.ts",
          file: "apps/mobile/shared/lib/foo.ts",
          function: "alpha",
          thresholdProfile: "lib",
          cyclomaticComplexity: 6,
          nloc: 31,
          parameterCount: 2,
        },
      ],
    })
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-lizard-complexity.ts", "--csv", csvPath, "--ledger", ledgerPath],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("worse");
});

test("fails when a new strict violation appears outside the checked-in ledger", () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    `${[
      '31,6,100,2,31,"alpha@10-40@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",10,40',
      '31,6,100,2,31,"beta@41-71@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","beta","beta",41,71',
    ].join("\n")}\n`
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: {
        lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
        default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
      },
      violations: [
        {
          key: "alpha@10-40@apps/mobile/shared/lib/foo.ts",
          file: "apps/mobile/shared/lib/foo.ts",
          function: "alpha",
          thresholdProfile: "lib",
          cyclomaticComplexity: 6,
          nloc: 31,
          parameterCount: 2,
        },
      ],
    })
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-lizard-complexity.ts", "--csv", csvPath, "--ledger", ledgerPath],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("new");
  expect(result.stderr.toString()).toContain("beta");
});

test("allows non-lib functions to exceed the lib-only strict thresholds", () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    '31,6,100,4,31,"screen@10-40@apps/mobile/features/foo/components/screen.tsx","apps/mobile/features/foo/components/screen.tsx","screen","screen",10,40\n'
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: {
        lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
        default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
      },
      violations: [],
    })
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-lizard-complexity.ts", "--csv", csvPath, "--ledger", ledgerPath],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(0);
});

test("can write a zero strict baseline ledger from a lizard csv report", async () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    '12,1,20,1,12,"ok@41-52@apps/mobile/foo.ts","apps/mobile/foo.ts","ok","ok",41,52\n'
  );

  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "scripts/check-lizard-complexity.ts",
      "--csv",
      csvPath,
      "--ledger",
      ledgerPath,
      "--write-ledger",
    ],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(0);

  const ledger = JSON.parse(await Bun.file(ledgerPath).text()) as {
    thresholds: Record<
      string,
      { cyclomaticComplexity: number; nloc: number; parameterCount: number }
    >;
    violations: Array<{ key: string; function: string }>;
  };

  expect(ledger.thresholds).toEqual({
    lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
    default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
  });
  expect(ledger.violations).toEqual([]);
});

test("refuses to write a non-zero strict baseline ledger without an explicit override", () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    '31,6,100,2,31,"alpha@10-40@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",10,40\n'
  );

  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "scripts/check-lizard-complexity.ts",
      "--csv",
      csvPath,
      "--ledger",
      ledgerPath,
      "--write-ledger",
    ],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Refusing to write a non-zero Lizard baseline");
});

test("can explicitly write a non-zero strict baseline ledger when override is passed", async () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    `${[
      '31,6,100,2,31,"alpha@10-40@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",10,40',
      '12,1,20,1,12,"ok@41-52@apps/mobile/foo.ts","apps/mobile/foo.ts","ok","ok",41,52',
      '35,5,100,4,35,"beta@53-87@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","beta","beta",53,87',
    ].join("\n")}\n`
  );

  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "scripts/check-lizard-complexity.ts",
      "--csv",
      csvPath,
      "--ledger",
      ledgerPath,
      "--write-ledger",
      "--allow-nonzero-write",
    ],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(0);

  const ledger = JSON.parse(await Bun.file(ledgerPath).text()) as {
    thresholds: Record<
      string,
      { cyclomaticComplexity: number; nloc: number; parameterCount: number }
    >;
    violations: Array<{ key: string; function: string }>;
  };

  expect(ledger.thresholds).toEqual({
    lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
    default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
  });
  expect(ledger.violations.map((violation) => violation.key)).toEqual([
    "alpha@10-40@apps/mobile/shared/lib/foo.ts",
    "beta@53-87@apps/mobile/shared/lib/foo.ts",
  ]);
});

test("matches same-named violations by location instead of ordinal occurrence", () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    `${[
      '31,6,100,2,31,"alpha@1-9@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",1,9',
      '31,6,100,2,31,"alpha@10-40@apps/mobile/shared/lib/foo.ts","apps/mobile/shared/lib/foo.ts","alpha","alpha",10,40',
    ].join("\n")}\n`
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: {
        lib: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
        default: { cyclomaticComplexity: 8, nloc: 50, parameterCount: 4 },
      },
      violations: [
        {
          key: "alpha@10-40@apps/mobile/shared/lib/foo.ts",
          file: "apps/mobile/shared/lib/foo.ts",
          function: "alpha",
          thresholdProfile: "lib",
          cyclomaticComplexity: 6,
          nloc: 31,
          parameterCount: 2,
        },
      ],
    })
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-lizard-complexity.ts", "--csv", csvPath, "--ledger", ledgerPath],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("alpha@1-9@apps/mobile/shared/lib/foo.ts");
  expect(result.stderr.toString()).not.toContain("alpha@10-40@apps/mobile/shared/lib/foo.ts");
});
