import { describe, expect, it } from "vitest";
import { getEntryTabTextStyle } from "@/shared/components/entry-tab-text-style";

describe("EntryScaffold tab text styles", () => {
  it("uses active color and weight for the selected tab", () => {
    expect(
      getEntryTabTextStyle({
        activeColor: "#22c55e",
        isActive: true,
        tertiary: "#737373",
      })
    ).toEqual({
      color: "#22c55e",
      fontWeight: "700",
    });
  });

  it("uses tertiary color and normal tab weight for inactive tabs", () => {
    expect(
      getEntryTabTextStyle({
        activeColor: "#22c55e",
        isActive: false,
        tertiary: "#737373",
      })
    ).toEqual({
      color: "#737373",
      fontWeight: "600",
    });
  });
});
