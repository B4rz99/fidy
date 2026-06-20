import { describe, expect, it } from "vitest";
import { getEntryTabTextStyle } from "@/shared/components/entry-tab-text-style";

describe("EntryScaffold tab text styles", () => {
  it("uses primary color and full opacity for the selected tab", () => {
    expect(
      getEntryTabTextStyle({
        isActive: true,
        primary: "#111111",
        tertiary: "#737373",
      })
    ).toEqual({
      color: "#111111",
      fontWeight: "700",
      opacity: 1,
    });
  });

  it("uses tertiary color and dimmed opacity for inactive tabs", () => {
    expect(
      getEntryTabTextStyle({
        isActive: false,
        primary: "#111111",
        tertiary: "#737373",
      })
    ).toEqual({
      color: "#737373",
      fontWeight: "600",
      opacity: 0.4,
    });
  });
});
