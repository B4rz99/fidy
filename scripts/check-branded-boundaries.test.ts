import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  collectBrandedBoundaryViolations,
  formatBrandedBoundaryFailure,
} from "./check-branded-boundaries";

const temporaryRoots: string[] = [];

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

function createFixtureRoot(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), "fidy-brands-"));
  temporaryRoots.push(root);

  const brandedTypesPath = path.join(root, "apps/mobile/shared/types/branded.ts");
  mkdirSync(path.dirname(brandedTypesPath), { recursive: true });
  writeFileSync(
    brandedTypesPath,
    [
      "export type Brand<T, B extends string> = T & { readonly __brand: B };",
      'export type UserId = Brand<string, "UserId">;',
      'export type IsoDate = Brand<string, "IsoDate">;',
      'export type CopAmount = Brand<number, "CopAmount">;',
    ].join("\n")
  );

  Object.entries(files).forEach(([relativePath, content]) => {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  });

  return root;
}

describe("check-branded-boundaries", () => {
  test("flags branded casts in app screens", () => {
    const root = createFixtureRoot({
      "apps/mobile/app/screen.tsx": [
        'import type { UserId } from "@/shared/types/branded";',
        'const sessionUserId = "user-1";',
        "export const screen = sessionUserId as UserId;",
      ].join("\n"),
    });

    const violations = collectBrandedBoundaryViolations({ rootDir: root });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.filePath).toBe("apps/mobile/app/screen.tsx");
    expect(violations[0]?.brandNames).toEqual(["UserId"]);
    expect(violations[0]?.uiRule).toBe("app/**");
  });

  test("flags union branded casts in feature components", () => {
    const root = createFixtureRoot({
      "apps/mobile/features/goals/components/Card.tsx": [
        'import type { UserId as AppUserId } from "@/shared/types/branded";',
        'const sessionUserId = "user-1";',
        "export const card = (sessionUserId || null) as AppUserId | null;",
      ].join("\n"),
    });

    const violations = collectBrandedBoundaryViolations({ rootDir: root });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.brandNames).toEqual(["UserId"]);
    expect(violations[0]?.uiRule).toBe("features/**/components/**");
  });

  test("flags branded casts through namespace imports", () => {
    const root = createFixtureRoot({
      "apps/mobile/app/profile.tsx": [
        'import type * as Branded from "@/shared/types/branded";',
        'const sessionUserId = "user-1";',
        "export const profile = sessionUserId as Branded.UserId;",
      ].join("\n"),
    });

    const violations = collectBrandedBoundaryViolations({ rootDir: root });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.brandNames).toEqual(["UserId"]);
    expect(violations[0]?.uiRule).toBe("app/**");
  });

  test("does not flag non-branded assertions in UI", () => {
    const root = createFixtureRoot({
      "apps/mobile/shared/components/Badge.tsx": [
        "const config = { label: 'ok' } as const;",
        "export const badge = config.label;",
      ].join("\n"),
    });

    const violations = collectBrandedBoundaryViolations({ rootDir: root });

    expect(violations).toHaveLength(0);
  });

  test("does not flag unrelated qualified names that are not imported from branded types", () => {
    const root = createFixtureRoot({
      "apps/mobile/app/local-namespace.tsx": [
        "declare namespace LocalTypes {",
        "  type UserId = string;",
        "}",
        'const sessionUserId = "user-1";',
        "export const localNamespace = sessionUserId as LocalTypes.UserId;",
      ].join("\n"),
    });

    const violations = collectBrandedBoundaryViolations({ rootDir: root });

    expect(violations).toHaveLength(0);
  });

  test("does not flag branded casts in allowed boundary files", () => {
    const root = createFixtureRoot({
      "apps/mobile/features/transactions/schema.ts": [
        'import type { UserId } from "@/shared/types/branded";',
        'export const schemaUserId = "user-1" as UserId;',
      ].join("\n"),
    });

    const violations = collectBrandedBoundaryViolations({ rootDir: root });

    expect(violations).toHaveLength(0);
  });

  test("formats a remediation message with the approved alternatives", () => {
    const root = createFixtureRoot({
      "apps/mobile/app/screen.tsx": [
        'import type { UserId } from "@/shared/types/branded";',
        'const sessionUserId = "user-1";',
        "export const screen = sessionUserId as UserId;",
      ].join("\n"),
    });

    const message = formatBrandedBoundaryFailure(
      collectBrandedBoundaryViolations({ rootDir: root })
    );

    expect(message).toContain("Branded boundary check failed.");
    expect(message).toContain("Use `useOptionalUserId()`");
    expect(message).toContain("apps/mobile/shared/types/assertions.ts");
    expect(message).toContain("apps/mobile/features/auth/public.ts");
    expect(message).toContain("apps/mobile/app/screen.tsx");
  });
});
