import { describe, expect, it } from "vitest";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";

describe("financial account route params", () => {
  it("returns null when the route param is missing", () => {
    expect(parseFinancialAccountRouteParam(undefined)).toBeNull();
  });

  it("returns null when the route param is blank", () => {
    expect(parseFinancialAccountRouteParam("   ")).toBeNull();
  });

  it("returns the branded account id when the route param is present", () => {
    expect(parseFinancialAccountRouteParam("fa-123")).toBe("fa-123");
  });
});
