import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth";
import { saveCurrentTransaction, useTransactionStore } from "@/features/transactions";
import { tryGetDb } from "@/shared/db";
import {
  captureWarning,
  parseIsoDate,
  trackAiMessageSent,
  trackTransactionCreated,
} from "@/shared/lib";
import { parseActionFromResponse } from "../lib/parse-action";
import type { ChatAction } from "../schema";
import { streamChat } from "../services/ai-chat-api";
import {
  addAssistantChatMessage,
  addUserChatMessage,
  createChatSession,
  useChatStore,
} from "../store";

let activeController: AbortController | null = null;

function resetStreamState(): void {
  useChatStore.getState().setStreaming(false);
  useChatStore.getState().setStreamingContent("");
  activeController = null;
}

export function cancelActiveStream(): void {
  activeController?.abort();
  resetStreamState();
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
      if (isStreaming || !text.trim() || !db || !userId) return;

      const store = useChatStore.getState();

      if (!store.currentSessionId) {
        await createChatSession(db, userId, text);
      }

      if (!useChatStore.getState().currentSessionId) {
        return;
      }

      await addUserChatMessage(db, userId, text);
      trackAiMessageSent();

      const allMessages = [
        ...store.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: text },
      ];

      store.setStreaming(true);
      store.setStreamingContent("");

      const controller = new AbortController();
      activeController = controller;

      let accumulated = "";

      try {
        await streamChat(
          allMessages,
          {
            onChunk: (chunk) => {
              accumulated += chunk;
              useChatStore.getState().setStreamingContent(accumulated);
            },
            onDone: () => {
              void (async () => {
                const action = parseActionFromResponse(accumulated);
                await addAssistantChatMessage(db, userId, accumulated, action);

                if (action?.type === "add") {
                  try {
                    await executeAction(action);
                  } catch (actionErr) {
                    captureWarning("ai_action_failed", {
                      actionType: action.type,
                      errorType: actionErr instanceof Error ? actionErr.message : "unknown",
                    });
                  }
                }

                resetStreamState();
              })();
            },
            onError: (error) => {
              void (async () => {
                const errorMessage =
                  accumulated || `I'm sorry, something went wrong. Please try again. (${error})`;
                await addAssistantChatMessage(db, userId, errorMessage);
                resetStreamState();
              })();
            },
          },
          controller.signal
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage =
            accumulated ||
            `I'm sorry, something went wrong. Please try again. (${err instanceof Error ? err.message : "Unknown error"})`;
          await addAssistantChatMessage(db, userId, errorMessage);
        }
        resetStreamState();
      }
    },
    [db, executeAction, isStreaming, userId]
  );

  return { sendMessage, cancelStream: cancelActiveStream, isStreaming, streamingContent };
}
