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
    '31,6,100,2,31,"alpha@10-40@apps/mobile/foo.ts","apps/mobile/foo.ts","alpha","alpha",10,40\n'
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
      violations: [
        {
          key: "apps/mobile/foo.ts::alpha::1",
          file: "apps/mobile/foo.ts",
          function: "alpha",
          occurrence: 1,
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
    '31,7,100,2,31,"alpha@10-40@apps/mobile/foo.ts","apps/mobile/foo.ts","alpha","alpha",10,40\n'
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
      violations: [
        {
          key: "apps/mobile/foo.ts::alpha::1",
          file: "apps/mobile/foo.ts",
          function: "alpha",
          occurrence: 1,
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
      '31,6,100,2,31,"alpha@10-40@apps/mobile/foo.ts","apps/mobile/foo.ts","alpha","alpha",10,40',
      '31,6,100,2,31,"beta@41-71@apps/mobile/foo.ts","apps/mobile/foo.ts","beta","beta",41,71',
    ].join("\n")}\n`
  );

  writeFileSync(
    ledgerPath,
    JSON.stringify({
      thresholds: { cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 },
      violations: [
        {
          key: "apps/mobile/foo.ts::alpha::1",
          file: "apps/mobile/foo.ts",
          function: "alpha",
          occurrence: 1,
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

test("can write a strict debt ledger from a lizard csv report", async () => {
  const dir = createTempDir();
  const csvPath = join(dir, "strict.csv");
  const ledgerPath = join(dir, "ledger.json");

  writeFileSync(
    csvPath,
    `${[
      '31,6,100,2,31,"alpha@10-40@apps/mobile/foo.ts","apps/mobile/foo.ts","alpha","alpha",10,40',
      '12,1,20,1,12,"ok@41-52@apps/mobile/foo.ts","apps/mobile/foo.ts","ok","ok",41,52',
      '35,5,100,4,35,"beta@53-87@apps/mobile/foo.ts","apps/mobile/foo.ts","beta","beta",53,87',
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
    ],
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode).toBe(0);

  const ledger = JSON.parse(await Bun.file(ledgerPath).text()) as {
    thresholds: { cyclomaticComplexity: number; nloc: number; parameterCount: number };
    violations: Array<{ key: string; function: string }>;
  };

  expect(ledger.thresholds).toEqual({ cyclomaticComplexity: 5, nloc: 30, parameterCount: 3 });
  expect(ledger.violations.map((violation) => violation.key)).toEqual([
    "apps/mobile/foo.ts::alpha::1",
    "apps/mobile/foo.ts::beta::1",
  ]);
});
