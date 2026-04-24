import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "syncable-feature-scaffold-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    rmSync(dir, { recursive: true, force: true });
  });
});

test("prints a persisted feature checklist in dry-run mode", () => {
  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "scripts/scaffold-syncable-feature.ts",
      "--feature",
      "transactions",
      "--table",
      "transactions",
      "--entity",
      "Transaction",
    ],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("# Syncable Feature Checklist: transactions");
  expect(result.stdout.toString()).toContain("apps/mobile/shared/db/schema.ts");
  expect(result.stdout.toString()).toContain("apps/mobile/drizzle/migrations.js");
  expect(result.stdout.toString()).toContain('enqueueSync(db, "transactions", rowId, operation)');
});

test("writes the checklist to the requested output path", () => {
  const root = createTempDir();
  const outputPath = join(root, ".context", "plans", "demo.md");

  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "scripts/scaffold-syncable-feature.ts",
      "--feature",
      "demo",
      "--table",
      "demo_rows",
      "--entity",
      "DemoRow",
      "--root",
      root,
      "--output",
      outputPath,
      "--write",
    ],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain(outputPath);
  expect(existsSync(outputPath)).toBe(true);
  expect(readFileSync(outputPath, "utf8")).toContain("apps/mobile/features/demo/public.ts");
  expect(readFileSync(outputPath, "utf8")).toContain('enqueueSync(db, "demo_rows", rowId, operation)');
});

test("fails when required arguments are missing", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/scaffold-syncable-feature.ts", "--feature", "demo"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Missing required option: --table");
});
