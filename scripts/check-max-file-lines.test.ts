import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "max-file-lines-"));
  tempDirs.push(dir);
  return dir;
};

const writeSourceFile = (root: string, relativePath: string, lines: number): void => {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(
    absolutePath,
    Array.from({ length: lines }, (_, index) => `line_${index + 1}`).join("\n")
  );
};

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    rmSync(dir, { recursive: true, force: true });
  });
});

test("reports oversized non-exempt files grouped by category in report-only mode", () => {
  const root = createTempDir();
  writeSourceFile(root, "apps/mobile/features/demo/components/LargeScreen.tsx", 6);
  writeSourceFile(root, "apps/mobile/features/demo/components/LargeScreen.test.tsx", 9);

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-max-file-lines.ts", "--root", root, "--max-lines", "5"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Oversized files: 1");
  expect(result.stdout.toString()).toContain("components: 1");
  expect(result.stdout.toString()).toContain(
    "apps/mobile/features/demo/components/LargeScreen.tsx"
  );
  expect(result.stdout.toString()).not.toContain("LargeScreen.test.tsx");
});

test("ignores structural exemptions and still reports remaining oversized files", () => {
  const root = createTempDir();
  writeSourceFile(root, "apps/mobile/app/_layout.tsx", 12);
  writeSourceFile(root, "apps/mobile/shared/db/schema.ts", 12);
  writeSourceFile(root, "apps/mobile/shared/i18n/locales/en.ts", 12);
  writeSourceFile(root, "supabase/functions/weekly-digest/index.ts", 12);
  writeSourceFile(root, "apps/mobile/features/demo/store.ts", 7);

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-max-file-lines.ts", "--root", root, "--max-lines", "5"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Oversized files: 1");
  expect(result.stdout.toString()).toContain("stores: 1");
  expect(result.stdout.toString()).toContain("apps/mobile/features/demo/store.ts");
  expect(result.stdout.toString()).not.toContain("apps/mobile/app/_layout.tsx");
  expect(result.stdout.toString()).not.toContain("apps/mobile/shared/db/schema.ts");
  expect(result.stdout.toString()).not.toContain("apps/mobile/shared/i18n/locales/en.ts");
  expect(result.stdout.toString()).not.toContain("supabase/functions/weekly-digest/index.ts");
});

test("does not overcount a file that ends with a trailing newline", () => {
  const root = createTempDir();
  const absolutePath = join(root, "apps/mobile/features/demo/components/ThresholdScreen.tsx");
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, "line_1\nline_2\nline_3\nline_4\nline_5\n");

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-max-file-lines.ts", "--root", root, "--max-lines", "5"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Oversized files: 0");
  expect(result.stdout.toString()).toContain("No oversized files found.");
  expect(result.stdout.toString()).not.toContain("ThresholdScreen.tsx");
});

test("fails in enforce mode when oversized files are present", () => {
  const root = createTempDir();
  writeSourceFile(root, "apps/mobile/features/demo/components/LargeScreen.tsx", 6);

  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "scripts/check-max-file-lines.ts",
      "--root",
      root,
      "--max-lines",
      "5",
      "--enforce",
    ],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain("Oversized files: 1");
  expect(result.stdout.toString()).toContain(
    "apps/mobile/features/demo/components/LargeScreen.tsx"
  );
});
