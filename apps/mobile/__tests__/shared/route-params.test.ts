import { describe, expect, it } from "vitest";
import { getFirstNonEmptyRouteParam } from "@/shared/lib";

describe("shared route params", () => {
  it("returns the first non-empty string route param", () => {
    expect(getFirstNonEmptyRouteParam("  category-1  ")).toBe("category-1");
    expect(getFirstNonEmptyRouteParam("   ")).toBeNull();
    expect(getFirstNonEmptyRouteParam(undefined)).toBeNull();
  });

  it("skips empty array route params before returning the first non-empty value", () => {
    expect(getFirstNonEmptyRouteParam(["", "  ", " goal-1 "])).toBe("goal-1");
    expect(getFirstNonEmptyRouteParam(["", "  "])).toBeNull();
  });
});
