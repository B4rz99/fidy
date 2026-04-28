#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dir, "..");
const IS_WINDOWS = process.platform === "win32";
const VENV_DIR = join(ROOT_DIR, ".cache", "lizard");
const REQUIREMENTS_FILE = join(ROOT_DIR, "scripts", "lizard-requirements.txt");
const REPORT_DIR = join(ROOT_DIR, ".context", "reports", "lizard", "strict");
const SUMMARY_SCRIPT = join(ROOT_DIR, "scripts", "summarize_lizard.py");
const REQUIREMENTS_HASH_FILE = join(VENV_DIR, ".requirements.sha256");
const LEDGER_PATH = join(ROOT_DIR, "plans", "lizard-complexity-debt.json");
const DEFAULT_CCN = "8";
const DEFAULT_NLOC = "50";
const DEFAULT_PARAMS = "4";

type ParsedArgs = {
  writeLedger: boolean;
  allowNonZeroWrite: boolean;
  targets: string[];
};

const parseArgs = (args: string[]): ParsedArgs => {
  let writeLedger = false;
  let allowNonZeroWrite = false;
  let collectTargets = false;
  const targets: string[] = [];

  for (const arg of args) {
    if (collectTargets) {
      targets.push(arg);
      continue;
    }

    if (arg === "--write-ledger") {
      writeLedger = true;
      continue;
    }

    if (arg === "--allow-nonzero-write") {
      allowNonZeroWrite = true;
      continue;
    }

    if (arg === "--") {
      collectTargets = true;
      continue;
    }

    targets.push(arg);
  }

  return {
    writeLedger,
    allowNonZeroWrite,
    targets: targets.length > 0 ? targets : ["apps/mobile", "apps/landing", "packages"],
  };
};

const commandExists = (command: string): boolean => {
  const result = Bun.spawnSync({
    cmd: IS_WINDOWS ? ["where.exe", command] : ["sh", "-c", `command -v ${command}`],
    stdout: "ignore",
    stderr: "ignore",
  });

  return result.exitCode === 0;
};

const pythonCandidates = (): string[] => {
  if (process.env.PYTHON_BIN) {
    return [process.env.PYTHON_BIN];
  }

  return IS_WINDOWS ? ["python", "py"] : ["python3", "python"];
};

const findPython = (): string => {
  const python = pythonCandidates().find(commandExists);

  if (!python) {
    throw new Error(`${IS_WINDOWS ? "python" : "python3"} is required to run Lizard.`);
  }

  return python;
};

const venvPython = (): string =>
  IS_WINDOWS ? join(VENV_DIR, "Scripts", "python.exe") : join(VENV_DIR, "bin", "python");

const venvLizard = (): string =>
  IS_WINDOWS ? join(VENV_DIR, "Scripts", "lizard.exe") : join(VENV_DIR, "bin", "lizard");

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const run = (cmd: string[], options?: { allowFailure?: boolean; stdoutPath?: string }): string => {
  const result = Bun.spawnSync({
    cmd,
    cwd: ROOT_DIR,
    stdout: options?.stdoutPath ? "pipe" : "pipe",
    stderr: "pipe",
  });

  if (options?.stdoutPath) {
    writeFileSync(options.stdoutPath, result.stdout);
  }

  if (!options?.allowFailure && result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    const stdout = result.stdout.toString();
    throw new Error(
      [`Command failed: ${cmd.join(" ")}`, stdout, stderr].filter(Boolean).join("\n")
    );
  }

  return result.stdout.toString().trim();
};

const ensureLizard = (): void => {
  const python = findPython();

  if (!existsSync(venvPython())) {
    run([python, "-m", "venv", VENV_DIR]);
  }

  const requiredHash = sha256(REQUIREMENTS_FILE);
  const currentHash = existsSync(REQUIREMENTS_HASH_FILE)
    ? readFileSync(REQUIREMENTS_HASH_FILE, "utf8")
    : "";

  const canImportLizard =
    Bun.spawnSync({
      cmd: [venvPython(), "-c", "import lizard"],
      cwd: ROOT_DIR,
      stdout: "ignore",
      stderr: "ignore",
    }).exitCode === 0;

  if (requiredHash !== currentHash || !canImportLizard) {
    run([
      venvPython(),
      "-m",
      "pip",
      "install",
      "--quiet",
      "--disable-pip-version-check",
      "-r",
      REQUIREMENTS_FILE,
    ]);
    writeFileSync(REQUIREMENTS_HASH_FILE, requiredHash);
  }
};

const { writeLedger, allowNonZeroWrite, targets } = parseArgs(Bun.argv.slice(2));

mkdirSync(REPORT_DIR, { recursive: true });
ensureLizard();

const version = run([venvLizard(), "--version"]);
const textReport = join(REPORT_DIR, "strict.txt");
const csvReport = join(REPORT_DIR, "strict.csv");
const warningsReport = join(REPORT_DIR, "strict-warnings.txt");
const summaryMarkdown = join(REPORT_DIR, "strict-summary.md");
const summaryJson = join(REPORT_DIR, "strict-summary.json");
const strictArgs = [
  "-l",
  "javascript",
  "-l",
  "typescript",
  "-x",
  "*/coverage/*",
  "-C",
  DEFAULT_CCN,
  "-L",
  DEFAULT_NLOC,
  "-a",
  DEFAULT_PARAMS,
];

run([venvLizard(), ...strictArgs, ...targets], { allowFailure: true, stdoutPath: textReport });
run([venvLizard(), ...strictArgs, "--csv", ...targets], {
  allowFailure: true,
  stdoutPath: csvReport,
});
run([venvLizard(), ...strictArgs, "-w", ...targets], {
  allowFailure: true,
  stdoutPath: warningsReport,
});

run([
  venvPython(),
  SUMMARY_SCRIPT,
  "--csv",
  csvReport,
  "--markdown",
  summaryMarkdown,
  "--json",
  summaryJson,
  "--version",
  version,
  "--ccn-threshold",
  DEFAULT_CCN,
  "--nloc-threshold",
  DEFAULT_NLOC,
  "--parameter-threshold",
  DEFAULT_PARAMS,
  ...targets.flatMap((target) => ["--target", target]),
]);

if (writeLedger) {
  run([
    "bun",
    "scripts/check-lizard-complexity.ts",
    "--csv",
    csvReport,
    "--ledger",
    LEDGER_PATH,
    "--write-ledger",
    ...(allowNonZeroWrite ? ["--allow-nonzero-write"] : []),
  ]);
  console.log(`Lizard strict baseline ledger written to ${LEDGER_PATH}`);
} else {
  run(["bun", "scripts/check-lizard-complexity.ts", "--csv", csvReport, "--ledger", LEDGER_PATH]);
}

console.log(`Lizard strict report written to ${REPORT_DIR}`);
