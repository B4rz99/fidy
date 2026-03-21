import { useCallback } from "react";
import { useTransactionStore } from "@/features/transactions";
import { captureWarning, parseIsoDate } from "@/shared/lib";
import type { IsoDate } from "@/shared/types/branded";
import { parseActionFromResponse } from "../lib/parse-action";
import type { ChatAction } from "../schema";
import { streamChat } from "../services/ai-chat-api";
import { useChatStore } from "../store";

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
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);

  const executeAction = useCallback(async (action: ChatAction) => {
    switch (action.type) {
      case "add": {
        const store = useTransactionStore.getState();
        store.setType(action.data.type);
        store.setDigits(String(action.data.amount));
        store.setCategoryId(action.data.categoryId);
        store.setDescription(action.data.description);
        store.setDate(parseIsoDate(action.data.date as IsoDate));
        try {
          await store.saveTransaction();
        } finally {
          store.resetForm();
        }
        break;
      }
      case "edit": {
        // Edit not yet fully wired
        break;
      }
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming || !text.trim()) return;

      const store = useChatStore.getState();

      let sessionId = store.currentSessionId;
      if (!sessionId) {
        sessionId = await store.createSession(text);
      }

      await store.addUserMessage(text);

      const allMessages = [
        ...store.messages.map((m) => ({
          role: m.role as "user" | "assistant",
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
            onDone: async () => {
              const action = parseActionFromResponse(accumulated);
              await useChatStore.getState().addAssistantMessage(accumulated, action);

              if (action && action.type === "add") {
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
            },
            onError: async (error) => {
              const errorMessage =
                accumulated || `I'm sorry, something went wrong. Please try again. (${error})`;
              await useChatStore.getState().addAssistantMessage(errorMessage);
              resetStreamState();
            },
          },
          controller.signal
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage =
            accumulated ||
            `I'm sorry, something went wrong. Please try again. (${err instanceof Error ? err.message : "Unknown error"})`;
          await useChatStore.getState().addAssistantMessage(errorMessage);
        }
        resetStreamState();
      }
    },
    [isStreaming, executeAction]
  );

  return { sendMessage, cancelStream: cancelActiveStream, isStreaming, streamingContent };
}
