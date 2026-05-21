import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../shared/components/DialogRouteFrame.tsx"),
  "utf-8"
).replace(/\r\n/g, "\n");

describe("DialogRouteFrame", () => {
  test("dismisses nested dialog stacks in one navigation action", () => {
    expect(source).toContain("router.dismiss(closeDepth)");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("closeDialogStack");
  });

  test("captures inner taps before the backdrop can dismiss", () => {
    expect(source).toContain("onStartShouldSetResponder={() => true}");
  });
});
