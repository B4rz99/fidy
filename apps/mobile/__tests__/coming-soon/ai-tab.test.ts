import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("AI tab", () => {
  const source = readFileSync(resolve(__dirname, "../../app/(tabs)/ai.tsx"), "utf-8");

  test("imports ComingSoonScreen", () => {
    expect(source).toContain("ComingSoonScreen");
  });

  test("imports Sparkles icon from lucide", () => {
    expect(source).toContain("Sparkles");
  });

  test("passes AI Advisor as headerTitle", () => {
    expect(source).toContain('headerTitle="AI Advisor"');
  });

  test("passes teaser headline", () => {
    expect(source).toContain('headline="Your AI Advisor is on its way"');
  });

  test("passes feature description", () => {
    expect(source).toContain("Smart insights about your spending");
  });
});
