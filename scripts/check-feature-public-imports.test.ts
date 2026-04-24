import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { extractOwnerFeatureFromPath } from "./check-feature-public-imports";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "feature-public-imports-"));
  tempDirs.push(dir);
  return dir;
};

const writeSourceFile = (root: string, relativePath: string, source: string): void => {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, source);
};

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    rmSync(dir, { recursive: true, force: true });
  });
});

test("reports broad barrel imports across feature boundaries", () => {
  const root = createTempDir();
  writeSourceFile(
    root,
    "apps/mobile/features/budget/store.ts",
    'import { useOptionalUserId } from "@/features/auth";\n'
  );
  writeSourceFile(
    root,
    "apps/mobile/features/auth/public.ts",
    "export const useOptionalUserId = () => null;\n"
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-feature-public-imports.ts", "--root", root],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Broad cross-feature barrel imports: 1");
  expect(result.stdout.toString()).toContain(
    "apps/mobile/features/budget/store.ts:1 imports @/features/auth"
  );
});

test("ignores same-feature barrels, tests, and explicit public imports", () => {
  const root = createTempDir();
  writeSourceFile(
    root,
    "apps/mobile/features/auth/store.ts",
    'import { useAuthMode } from "@/features/auth";\n'
  );
  writeSourceFile(
    root,
    "apps/mobile/features/budget/store.ts",
    'import { useOptionalUserId } from "@/features/auth/public";\n'
  );
  writeSourceFile(
    root,
    "apps/mobile/features/budget/store.test.ts",
    'import { useOptionalUserId } from "@/features/auth";\n'
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-feature-public-imports.ts", "--root", root, "--enforce"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Broad cross-feature barrel imports: 0");
  expect(result.stdout.toString()).toContain("No broad cross-feature barrel imports found.");
});

test("fails in enforce mode when violations are present", () => {
  const root = createTempDir();
  writeSourceFile(
    root,
    "apps/mobile/features/search/store.ts",
    'import { refreshTransactions } from "@/features/transactions";\n'
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-feature-public-imports.ts", "--root", root, "--enforce"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain("Broad cross-feature barrel imports: 1");
  expect(result.stdout.toString()).toContain(
    "apps/mobile/features/search/store.ts:1 imports @/features/transactions"
  );
});

test("extracts feature owners from Windows-style paths", () => {
  expect(
    extractOwnerFeatureFromPath("C:\\repo\\apps\\mobile\\features\\notifications\\bootstrap.ts")
  ).toBe("notifications");
});
