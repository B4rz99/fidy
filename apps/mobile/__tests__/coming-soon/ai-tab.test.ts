import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("AI tab", () => {
  const source = readFileSync(resolve(__dirname, "../../app/(tabs)/(ai)/index.tsx"), "utf-8");
  const chatRouteSource = readFileSync(
    resolve(__dirname, "../../app/(tabs)/(ai)/chat.tsx"),
    "utf-8"
  );

  test("imports ConversationList component", () => {
    expect(source).toContain("ConversationList");
  });

  test("renders ChatScreen from the chat route", () => {
    expect(chatRouteSource).toContain("ChatScreen");
  });

  test("opens chats through the nested chat route", () => {
    expect(source).toContain('push("/(tabs)/(ai)/chat")');
    expect(chatRouteSource).toContain("<ChatScreen />");
  });

  test("does not use local view state for navigation", () => {
    expect(source).not.toContain("AiView");
    expect(source).not.toContain("useState<");
  });

  test("does not extract memories when leaving chat", () => {
    expect(source).not.toContain("useExtractUserMemoriesMutation");
    expect(source).not.toContain("extract_memories");
  });
});
