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

  test("passes new-chat action into the chat view", () => {
    expect(source).toContain(
      "<ChatScreen onBack={handleBackFromChat} onNewChat={handleNewChat} />"
    );
  });

  test("manages view state for navigation", () => {
    expect(source).toContain("AiView");
    expect(source).toContain('"list"');
    expect(source).toContain('"chat"');
  });

  test("does not extract memories when leaving chat", () => {
    expect(source).not.toContain("useExtractUserMemoriesMutation");
    expect(source).not.toContain("extract_memories");
  });
});
