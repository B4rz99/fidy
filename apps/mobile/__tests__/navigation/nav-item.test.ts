import { describe, expect, test } from "vitest";
import { NavItem } from "@/shared/components/navigation/NavItem";

describe("NavItem", () => {
  test("is exported as a named function", () => {
    expect(typeof NavItem).toBe("function");
  });
});
