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
  it("uses the SDK 55 community DateTimePicker package", () => {
    const sources = sourceRoots.flatMap((root) => readSources(resolve(appRoot, root)));
    const communityImports = sources.filter(({ source }) =>
      source.includes("@react-native-community/datetimepicker")
    );

    expect(communityImports).not.toEqual([]);
    expect(
      sources.filter(({ source }) => source.includes("@expo/ui/community/datetime-picker"))
    ).toEqual([]);
  });

  it("uses the SDK 55 DateTimePicker change event", () => {
    const sources = sourceRoots.flatMap((root) => readSources(resolve(appRoot, root)));
    const datePickerSources = sources.filter(({ source }) =>
      source.includes("@react-native-community/datetimepicker")
    );

    expect(datePickerSources).not.toEqual([]);
    expect(datePickerSources.every(({ source }) => source.includes("onChange="))).toBe(true);
    expect(datePickerSources.filter(({ source }) => source.includes("onValueChange="))).toEqual([]);
  });

  it("keeps DateTimePicker accentColor scoped to iOS", () => {
    const source = readFileSync(
      resolve(appRoot, "features/goals/components/goal-sheet/GoalDateField.tsx"),
      "utf-8"
    );

    expect(source).toContain('Platform.OS === "ios" ? { accentColor: accentGreen } : {}');
    expect(source).toContain("{...iosPickerStyleProps}");
  });
});
