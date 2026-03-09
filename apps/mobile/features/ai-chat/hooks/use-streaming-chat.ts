import { useCallback, useRef } from "react";
import { useTransactionStore } from "@/features/transactions/store";
import { parseIsoDate, toIsoDate } from "@/shared/lib/format-date";
import { buildChatContext } from "../lib/build-context";
import { parseActionFromResponse } from "../lib/parse-action";
import type { ChatAction } from "../schema";
import { streamChat } from "../services/ai-chat-api";
import { useChatStore } from "../store";

export function useStreamingChat() {
  const abortRef = useRef<AbortController | null>(null);

  const {
    messages,
    currentSessionId,
    memories,
    isStreaming,
    streamingContent,
    createSession,
    addUserMessage,
    addAssistantMessage,
    setStreaming,
    setStreamingContent,
  } = useChatStore();

  const executeAction = useCallback(async (action: ChatAction) => {
    switch (action.type) {
      case "add": {
        const store = useTransactionStore.getState();
        store.setType(action.data.type);
        store.setDigits(String(action.data.amountCents));
        store.setCategoryId(action.data.categoryId);
        store.setDescription(action.data.description);
        store.setDate(parseIsoDate(action.data.date));
        await store.saveTransaction();
        store.resetForm();
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

      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createSession(text);
      }

      await addUserMessage(text);

      const currentMonth = toIsoDate(new Date()).slice(0, 7);
      const context = buildChatContext(
        useTransactionStore.getState().transactions,
        memories,
        currentMonth
      );

      const allMessages = [
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: text },
      ];

      setStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";

      await streamChat(
        allMessages,
        context,
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamingContent(accumulated);
          },
          onDone: async () => {
            const action = parseActionFromResponse(accumulated);
            await addAssistantMessage(accumulated, action);

            // Auto-execute add/edit actions immediately (no confirmation needed)
            if (action && action.type !== "delete") {
              await executeAction(action);
            }

            setStreaming(false);
            setStreamingContent("");
            abortRef.current = null;
          },
          onError: async (error) => {
            const errorMessage =
              accumulated || `I'm sorry, something went wrong. Please try again. (${error})`;
            await addAssistantMessage(errorMessage);
            setStreaming(false);
            setStreamingContent("");
            abortRef.current = null;
          },
        },
        controller.signal
      );
    },
    [
      isStreaming,
      currentSessionId,
      messages,
      memories,
      createSession,
      addUserMessage,
      addAssistantMessage,
      executeAction,
      setStreaming,
      setStreamingContent,
    ]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setStreamingContent("");
  }, [setStreaming, setStreamingContent]);

  return { sendMessage, cancelStream, isStreaming, streamingContent };
}
