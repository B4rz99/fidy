import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ConversationList, selectChatSession, startNewChat } from "@/features/ai-chat";
import { useOptionalUserId } from "@/features/auth";
import { tryGetDb } from "@/shared/db";
import type { ChatSessionId } from "@/shared/types/branded";

export default function AiTab() {
  const { push } = useRouter();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const handleSelectSession = useCallback(
    async (id: ChatSessionId) => {
      if (!db || !userId) return;
      await selectChatSession(db, userId, id);
      push("/(tabs)/(ai)/chat");
    },
    [db, push, userId]
  );

  const handleNewChat = useCallback(() => {
    startNewChat();
    push("/(tabs)/(ai)/chat");
  }, [push]);

  return (
    <ConversationList
      onSelectSession={(id) => {
        void handleSelectSession(id);
      }}
      onNewChat={handleNewChat}
    />
  );
}
