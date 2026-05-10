import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "../..");

function collectSourceFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", "android", "ios", ".expo"].includes(entry.name)) return [];
      return collectSourceFiles(path);
    }

    if (!entry.isFile() || !/\.[cm]?[tj]sx?$/.test(entry.name)) return [];

    return [path];
  });
}

describe("navigation imports", () => {
  it("uses Expo Router APIs instead of direct React Navigation imports", () => {
    const offenders = collectSourceFiles(appRoot).filter((filePath) => {
      const source = readFileSync(filePath, "utf-8");

      return /from\s+["']@react-navigation\//.test(source);
    });

    expect(offenders.map((filePath) => filePath.replace(`${appRoot}/`, ""))).toEqual([]);
  });
});
