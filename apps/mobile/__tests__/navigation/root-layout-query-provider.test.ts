import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Root layout query provider", () => {
  const source = readFileSync(resolve(__dirname, "../../app/_layout.tsx"), "utf-8");

  test("wraps the app tree in QueryProvider", () => {
    expect(source).toContain('import { QueryProvider } from "@/shared/query"');
    expect(source).toContain("<QueryProvider>");
    expect(source).toContain("</QueryProvider>");
  });

  test("keeps the existing root Stack screen declarations", () => {
    for (const screen of ["(auth)", "(tabs)", "add-bill", "delete-account", "analytics"]) {
      expect(source).toContain(`name="${screen}"`);
    }
  });
});
