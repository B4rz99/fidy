import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth";
import { saveCurrentTransaction, useTransactionStore } from "@/features/transactions";
import { tryGetDb } from "@/shared/db";
import { parseIsoDate, trackAiMessageSent, trackTransactionCreated } from "@/shared/lib";
import { parseActionFromResponse } from "../lib/parse-action";
import type { ChatAction } from "../schema";
import { streamChat } from "../services/ai-chat-api";
import { createStreamingChatService } from "../services/create-streaming-chat-service";
import {
  addAssistantChatMessage,
  addUserChatMessage,
  createChatSession,
  useChatStore,
} from "../store";

const streamingChatService = createStreamingChatService({
  getState: () => {
    const state = useChatStore.getState();
    return {
      isStreaming: state.isStreaming,
      currentSessionId: state.currentSessionId,
      messages: state.messages,
    };
  },
  setStreaming: (isStreaming) => useChatStore.getState().setStreaming(isStreaming),
  setStreamingContent: (content) => useChatStore.getState().setStreamingContent(content),
  streamChat,
  createChatSession,
  addUserChatMessage,
  addAssistantChatMessage,
  parseActionFromResponse,
  trackAiMessageSent,
});

export function cancelActiveStream(): void {
  streamingChatService.cancel();
}

export function useStreamingChat() {
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);

  const executeAction = useCallback(
    async (action: ChatAction) => {
      switch (action.type) {
        case "add": {
          const store = useTransactionStore.getState();
          if (!db || !userId) return;
          store.setType(action.data.type);
          store.setDigits(String(action.data.amount));
          store.setCategoryId(action.data.categoryId);
          store.setDescription(action.data.description);
          store.setDate(parseIsoDate(action.data.date));
          try {
            const result = await saveCurrentTransaction(db, userId);
            if (result.success) {
              trackTransactionCreated({
                type: action.data.type,
                category: String(action.data.categoryId),
                source: "ai_chat",
              });
            }
          } finally {
            store.resetForm();
          }
          break;
        }
        case "edit": {
          // Edit not yet fully wired
          break;
        }
        case "delete": {
          // Delete handled via updateActionStatus flow in ChatScreen
          break;
        }
      }
    },
    [db, userId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      await streamingChatService.sendMessage({ db, userId, text, executeAction });
    },
    [db, executeAction, userId]
  );

  return { sendMessage, cancelStream: cancelActiveStream, isStreaming, streamingContent };
}
