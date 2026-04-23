import { describe, expect, it } from "vitest";
import { create } from "zustand";
import type { ChatMessage } from "@/features/ai-chat/schema";
import { createChatStoreState } from "@/features/ai-chat/store/state";
import { requireUserId } from "@/shared/types/assertions";
import type { ChatMessageId, ChatSessionId, IsoDateTime } from "@/shared/types/branded";

describe("ai chat store state helper", () => {
  it("begins a session and clears current conversation state", () => {
    const store = create(createChatStoreState);

    store.getState().beginSession(requireUserId("user-1"));
    store.getState().setCurrentSessionId("chat-1" as ChatSessionId);
    store.getState().appendMessage({
      id: "message-1" as ChatMessageId,
      sessionId: "chat-1" as ChatSessionId,
      role: "assistant",
      content: "hello",
      action: null,
      actionStatus: null,
      createdAt: "2026-04-18T10:15:00.000Z" as IsoDateTime,
    });
    store.getState().setStreaming(true);
    store.getState().setStreamingContent("partial");

    store.getState().clearCurrentConversation();

    expect(store.getState()).toMatchObject({
      activeUserId: requireUserId("user-1"),
      currentSessionId: null,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
  });

  it("removes the active session and updates only the matching action status", () => {
    const store = create(createChatStoreState);
    const activeSessionId = "chat-1" as ChatSessionId;
    const otherSessionId = "chat-2" as ChatSessionId;
    const activeMessage: ChatMessage = {
      id: "message-active" as ChatMessageId,
      sessionId: activeSessionId,
      role: "assistant",
      content: "hello",
      action: null,
      actionStatus: null,
      createdAt: "2026-04-18T10:15:00.000Z" as IsoDateTime,
    };
    const otherMessage: ChatMessage = {
      id: "message-other" as ChatMessageId,
      sessionId: otherSessionId,
      role: "assistant",
      content: "hello",
      action: null,
      actionStatus: null,
      createdAt: "2026-04-18T10:15:00.000Z" as IsoDateTime,
    };

    store.setState({
      activeUserId: requireUserId("user-1"),
      sessions: [
        {
          id: activeSessionId,
          userId: requireUserId("user-1"),
          title: "Active",
          createdAt: "2026-04-18T10:00:00.000Z" as IsoDateTime,
          expiresAt: "2026-05-18T10:00:00.000Z" as IsoDateTime,
          deletedAt: null,
        },
      ],
      currentSessionId: activeSessionId,
      messages: [activeMessage, otherMessage],
      isStreaming: false,
      streamingContent: "",
      expiredSessionCount: 0,
    });

    store.getState().setMessageActionStatus(activeMessage.id, "confirmed");
    store.getState().removeSession(activeSessionId);

    expect(store.getState()).toMatchObject({
      currentSessionId: null,
      messages: [],
      sessions: [],
    });
    expect(otherMessage.actionStatus).toBeNull();
  });
});
