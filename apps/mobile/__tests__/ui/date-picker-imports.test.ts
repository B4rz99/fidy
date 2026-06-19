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
  it("keeps the native date picker package behind the shared adapter", () => {
    const sources = sourceRoots.flatMap((root) => readSources(resolve(appRoot, root)));
    const nativeDatePickerImports = sources
      .filter(
        ({ source }) =>
          source.includes("@react-native-community/datetimepicker") ||
          source.includes("@expo/ui/community/datetime-picker")
      )
      .map(({ path }) => path);

    expect(nativeDatePickerImports).toEqual(["shared/components/DatePickerControl.tsx"]);
  });

  it("exposes date selection instead of native DateTimePicker events", () => {
    const sources = sourceRoots.flatMap((root) => readSources(resolve(appRoot, root)));
    const featureDatePickerSources = sources.filter(
      ({ path, source }) => path.startsWith("features/") && source.includes("DatePicker")
    );
    const datePickerControlSource = readFileSync(
      resolve(appRoot, "shared/components/DatePickerControl.tsx"),
      "utf-8"
    );

    expect(datePickerControlSource).toContain("onSelect");
    expect(datePickerControlSource).toContain("isDatePickerDismissed");
    expect(
      featureDatePickerSources.filter(({ source }) => source.includes("@react-native-community"))
    ).toEqual([]);
    expect(featureDatePickerSources.filter(({ source }) => source.includes("event.type"))).toEqual(
      []
    );
    expect(featureDatePickerSources.filter(({ source }) => source.includes("_event"))).toEqual([]);
  });

  it("keeps goal date selection on the shared transaction date picker sheet", () => {
    const source = readFileSync(
      resolve(appRoot, "features/goals/components/goal-form/GoalDateField.tsx"),
      "utf-8"
    );

    expect(source).toContain("TransactionDatePickerDialog");
    expect(source).toContain("allowFuture");
    expect(source).toContain("minimumDate={minimumDate}");
    expect(source).not.toContain("@react-native-community/datetimepicker");
    expect(source).not.toContain("@expo/ui/community/datetime-picker");
  });
});
