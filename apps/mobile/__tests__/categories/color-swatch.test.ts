import { describe, expect, it } from "vitest";
import { getReadableSwatchCheckColor } from "@/features/categories/lib/color-swatch";
import { Colors } from "@/shared/constants/theme";

describe("getReadableSwatchCheckColor", () => {
  it("uses a light check on dark swatches", () => {
    expect(getReadableSwatchCheckColor("#2E7D32")).toBe(Colors.light.onAccent);
  });

  it("uses a dark check on light swatches", () => {
    expect(getReadableSwatchCheckColor("#FFCA28")).toBe(Colors.dark.onAccent);
  });

  it("falls back to a light check for unknown color shapes", () => {
    expect(getReadableSwatchCheckColor("accent")).toBe(Colors.light.onAccent);
  });
});
