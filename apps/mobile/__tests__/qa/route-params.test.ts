import { describe, expect, it } from "vitest";
import {
  parseLocalQaProfileRouteParam,
  parseQaTargetKeyRouteParam,
  parseQaTargetRouteParam,
} from "@/features/qa/lib/route-params";

describe("QA route params", () => {
  it("returns null when the local QA profile route param is missing or blank", () => {
    expect(parseLocalQaProfileRouteParam(undefined)).toBeNull();
    expect(parseLocalQaProfileRouteParam("   ")).toBeNull();
  });

  it("accepts the first local QA profile value from array params", () => {
    expect(parseLocalQaProfileRouteParam(["transfer-ready", "default"])).toBe("transfer-ready");
  });

  it("rejects unknown local QA profile values", () => {
    expect(parseLocalQaProfileRouteParam("does-not-exist")).toBeNull();
  });

  it("returns null when the QA target route param is missing or blank", () => {
    expect(parseQaTargetRouteParam(undefined)).toBeNull();
    expect(parseQaTargetRouteParam("   ")).toBeNull();
  });

  it("accepts the first QA target value from array params", () => {
    expect(parseQaTargetRouteParam(["/add-transfer", "/profile"])).toBe("/add-transfer");
  });

  it("rejects unknown QA targets", () => {
    expect(parseQaTargetRouteParam("/does-not-exist")).toBeNull();
  });

  it("maps QA target keys to their route targets", () => {
    expect(parseQaTargetKeyRouteParam("add-transfer")).toBe("/add-transfer");
    expect(parseQaTargetKeyRouteParam(["financial-accounts"])).toBe("/financial-accounts");
  });

  it("rejects unknown QA target keys", () => {
    expect(parseQaTargetKeyRouteParam("not-a-target")).toBeNull();
  });
});
