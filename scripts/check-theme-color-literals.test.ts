import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "theme-color-literals-"));
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

test("fails enforce mode when a color literal is not in the baseline", () => {
  const root = createTempDir();
  writeSourceFile(
    root,
    "apps/mobile/features/chat/components/NewBubble.tsx",
    'export const styles = { backgroundColor: "#000000" };\n'
  );
  writeSourceFile(root, "scripts/theme-color-literals-baseline.json", "[]\n");

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-theme-color-literals.ts", "--root", root, "--enforce"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toContain("New hardcoded theme color literals: 1");
  expect(result.stdout.toString()).toContain(
    "apps/mobile/features/chat/components/NewBubble.tsx:1 uses #000000"
  );
});

test("passes enforce mode when the literal is already in the baseline", () => {
  const root = createTempDir();
  const source = 'export const styles = { backgroundColor: "#000000" };';
  writeSourceFile(root, "apps/mobile/features/chat/components/LegacyBubble.tsx", `${source}\n`);
  writeSourceFile(
    root,
    "scripts/theme-color-literals-baseline.json",
    JSON.stringify([`apps/mobile/features/chat/components/LegacyBubble.tsx\t#000000\t${source}`])
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-theme-color-literals.ts", "--root", root, "--enforce"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("New hardcoded theme color literals: 0");
});

test("allows color literals in the central theme file", () => {
  const root = createTempDir();
  writeSourceFile(
    root,
    "apps/mobile/shared/constants/theme.ts",
    'export const Colors = { light: { page: "#FAEBD7" } };\n'
  );
  writeSourceFile(root, "scripts/theme-color-literals-baseline.json", "[]\n");

  const result = Bun.spawnSync({
    cmd: ["bun", "scripts/check-theme-color-literals.ts", "--root", root, "--enforce"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Hardcoded theme color literals: 0");
});
