import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { enUS } from "date-fns/locale";
import { describe, expect, test } from "vitest";
import { buildGroupedSessions } from "@/features/ai-chat/lib/session-list-items";
import type { ChatSession } from "@/features/ai-chat/schema";
import { requireChatSessionId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

describe("AI chat redesign", () => {
  // apps/mobile is CommonJS today; if the mobile test runtime moves to ESM,
  // switch these source fixtures to import.meta.url.
  const starterSuggestionsSource = readFileSync(
    resolve(__dirname, "../../features/ai-chat/components/StarterSuggestions.tsx"),
    "utf-8"
  );
  const messageBubbleSource = readFileSync(
    resolve(__dirname, "../../features/ai-chat/components/MessageBubble.tsx"),
    "utf-8"
  );
  const actionCardSource = readFileSync(
    resolve(__dirname, "../../features/ai-chat/components/ActionCard.tsx"),
    "utf-8"
  );
  const conversationListSource = readFileSync(
    resolve(__dirname, "../../features/ai-chat/components/ConversationList.tsx"),
    "utf-8"
  );

  const makeSession = (id: string, createdAt: string, title = id): ChatSession => ({
    id: requireChatSessionId(id),
    userId: requireUserId("user-1"),
    title,
    createdAt: requireIsoDateTime(createdAt),
    expiresAt: requireIsoDateTime("2026-07-01T00:00:00.000Z"),
    deletedAt: null,
  });

  test("renders the concierge prompt for a new chat", () => {
    expect(starterSuggestionsSource).toContain('t("aiChat.concierge.label")');
    expect(starterSuggestionsSource).toContain('t("aiChat.concierge.title")');
    expect(starterSuggestionsSource).toContain('t("aiChat.concierge.subtitle")');
  });

  test("renders ledger-style conversation rows and localized action cards", () => {
    expect(messageBubbleSource).toContain("agentIcon");
    expect(messageBubbleSource).toContain("borderBottomLeftRadius: 6");
    expect(messageBubbleSource).toContain("borderBottomRightRadius: 6");
    expect(actionCardSource).toContain('t("aiChat.actions.deleteTransaction")');
    expect(actionCardSource).toContain('t("common.cancel")');
    expect(actionCardSource).toContain('t("common.delete")');
  });

  test("renders grouped chat history with only the retained subtitle copy", () => {
    expect(conversationListSource).toContain("buildGroupedSessions");
    expect(conversationListSource).toContain('t("aiChat.conversationsSubtitle")');
    expect(conversationListSource).not.toContain('t("aiChat.noConversations")');
    expect(conversationListSource).not.toContain('t("aiChat.tapToStart")');
  });

  test("groups sessions by stable date bucket instead of display label", () => {
    const sessions = [
      makeSession("chat-2024", "2024-05-22T14:00:00.000Z"),
      makeSession("chat-2023", "2023-05-22T14:00:00.000Z"),
    ];

    const items = buildGroupedSessions(sessions, enUS, (key) => key);

    expect(
      items.map((item) =>
        item.type === "date"
          ? { type: item.type, id: item.id, label: item.label }
          : { type: item.type, id: item.session.id }
      )
    ).toEqual([
      { type: "date", id: "date-2024-05-22", label: "May 22, 2024" },
      { type: "session", id: "chat-2024" },
      { type: "date", id: "date-2023-05-22", label: "May 22, 2023" },
      { type: "session", id: "chat-2023" },
    ]);
    const dateIds = items.filter((item) => item.type === "date").map((item) => item.id);
    expect(new Set(dateIds).size).toBe(dateIds.length);
  });
});
