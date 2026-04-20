import { describe, expect, it } from "vitest";
import { resolveSearchRouteFilters } from "@/features/search/lib/route-params";

describe("resolveSearchRouteFilters", () => {
  it("prefers the normalized categoryId param", () => {
    expect(resolveSearchRouteFilters({ categoryId: "food", category: "transport" })).toEqual({
      categoryIds: ["food"],
    });
  });

  it("falls back to the legacy category param", () => {
    expect(resolveSearchRouteFilters({ category: "transport" })).toEqual({
      categoryIds: ["transport"],
    });
  });

  it("returns an empty partial when no category filter exists", () => {
    expect(resolveSearchRouteFilters({ category: "   " })).toEqual({});
  });
});
