import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Goals tab", () => {
  const source = readFileSync(resolve(__dirname, "../../app/(tabs)/goals.tsx"), "utf-8");

  test("imports ComingSoonScreen", () => {
    expect(source).toContain("ComingSoonScreen");
  });

  test("imports Target icon from lucide", () => {
    expect(source).toContain("Target");
  });

  test("passes Goals as headerTitle", () => {
    expect(source).toContain('headerTitle="Goals"');
  });

  test("passes teaser headline", () => {
    expect(source).toContain('headline="Goals are on their way"');
  });

  test("passes feature description", () => {
    expect(source).toContain("Set savings targets");
  });
});
