import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "../..");
const sourceRoots = ["app", "features", "shared"] as const;

function readSources(dir: string): readonly { readonly path: string; readonly source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return readSources(path);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [{ path: relative(appRoot, path), source: readFileSync(path, "utf-8") }];
  });
}

describe("date picker imports", () => {
  it("uses the Expo UI DateTimePicker drop-in instead of the community package", () => {
    const sources = sourceRoots.flatMap((root) => readSources(resolve(appRoot, root)));
    const communityImports = sources.filter(({ source }) =>
      source.includes("@react-native-community/datetimepicker")
    );

    expect(communityImports).toEqual([]);
    expect(
      sources.some(({ source }) => source.includes("@expo/ui/community/datetime-picker"))
    ).toBe(true);
  });

  it("uses Expo UI value and dismiss events instead of deprecated DateTimePicker onChange", () => {
    const sources = sourceRoots.flatMap((root) => readSources(resolve(appRoot, root)));
    const datePickerSources = sources.filter(({ source }) =>
      source.includes("@expo/ui/community/datetime-picker")
    );

    expect(datePickerSources).not.toEqual([]);
    expect(datePickerSources.filter(({ source }) => source.includes("onChange="))).toEqual([]);
    expect(datePickerSources.every(({ source }) => source.includes("onValueChange="))).toBe(true);
  });
});
