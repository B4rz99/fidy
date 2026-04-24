import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { saveCurrentTransaction, useTransactionStore } from "@/features/transactions/store.public";
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

type UserDb = NonNullable<ReturnType<typeof tryGetDb>>;
type OptionalUserId = ReturnType<typeof useOptionalUserId>;
type AddAction = Extract<ChatAction, { type: "add" }>;

function populateTransactionDraft(action: AddAction) {
  const store = useTransactionStore.getState();
  store.setType(action.data.type);
  store.setDigits(String(action.data.amount));
  store.setCategoryId(action.data.categoryId);
  store.setDescription(action.data.description);
  store.setDate(parseIsoDate(action.data.date));
  return store;
}

function trackAddActionCreated(action: AddAction) {
  trackTransactionCreated({
    type: action.data.type,
    category: String(action.data.categoryId),
    source: "ai_chat",
  });
}

async function saveAddActionTransaction(
  action: AddAction,
  db: UserDb,
  userId: NonNullable<OptionalUserId>
) {
  return (await saveCurrentTransaction(db, userId)).success
    ? trackAddActionCreated(action)
    : undefined;
}

async function executeAddAction(action: AddAction, db: UserDb | null, userId: OptionalUserId) {
  if (!db || !userId) return;
  const activeDb = db;
  const activeUserId = userId;
  const store = populateTransactionDraft(action);
  return Promise.resolve(saveAddActionTransaction(action, activeDb, activeUserId)).finally(() =>
    store.resetForm()
  );
}

export function useStreamingChat() {
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);

  const executeAction = useCallback(
    async (action: ChatAction) => {
      if (action.type !== "add") {
        return;
      }

      await executeAddAction(action, db, userId);
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
