import { describe, expect, it } from "vitest";
import { resolveSearchRouteFilters } from "@/features/search/lib/route-params";

describe("resolveSearchRouteFilters", () => {
  it("reads the categoryId param", () => {
    expect(resolveSearchRouteFilters({ categoryId: "food" })).toEqual({
      categoryIds: ["food"],
    });
  });

  it("reads the first non-empty categoryId param", () => {
    expect(resolveSearchRouteFilters({ categoryId: ["   ", "transport"] })).toEqual({
      categoryIds: ["transport"],
    });
  });

  it("returns an empty partial when no category filter exists", () => {
    expect(resolveSearchRouteFilters({ categoryId: "   " })).toEqual({});
  });
});
