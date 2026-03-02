import { describe, expect, test } from "vitest";
import { AddNavButton } from "@/shared/components/navigation/AddNavButton";

describe("AddNavButton", () => {
  test("is exported as a function component", () => {
    expect(typeof AddNavButton).toBe("function");
  });

  test("accepts props argument", () => {
    expect(AddNavButton.length).toBeLessThanOrEqual(1);
  });
});
