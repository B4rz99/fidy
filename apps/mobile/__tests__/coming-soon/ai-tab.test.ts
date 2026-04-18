import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("AI tab", () => {
  const source = readFileSync(resolve(__dirname, "../../app/(tabs)/(ai)/index.tsx"), "utf-8");

  test("imports ConversationList component", () => {
    expect(source).toContain("ConversationList");
  });

  test("imports ChatScreen component", () => {
    expect(source).toContain("ChatScreen");
  });

  test("manages view state for navigation", () => {
    expect(source).toContain("AiView");
    expect(source).toContain('"list"');
    expect(source).toContain('"chat"');
  });

  test("extracts memories when leaving chat", () => {
    expect(source).toContain("useExtractUserMemoriesMutation");
    expect(source).toContain("mutateAsync");
  });
});
