import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("PeriodShiftContent", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/analytics/components/PeriodShiftContent.tsx"),
    "utf-8"
  );

  test("keeps category bars opaque until a category is selected", () => {
    expect(source).toContain("dimmed={selectedCategoryId !== null && !isSelected}");
    expect(source).not.toContain("dimmed={!isSelected}");
  });
});
