import { useCallback, useState } from "react";
import {
  ChatScreen,
  ConversationList,
  cancelActiveStream,
  selectChatSession,
  startNewChat,
} from "@/features/ai-chat";
import { useOptionalUserId } from "@/features/auth";
import { tryGetDb } from "@/shared/db";
import type { ChatSessionId } from "@/shared/types/branded";

type AiView = "list" | "chat";

export default function AiTab() {
  const [view, setView] = useState<AiView>("list");
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;

  const handleSelectSession = useCallback(
    async (id: ChatSessionId) => {
      if (!db || !userId) return;
      await selectChatSession(db, userId, id);
      setView("chat");
    },
    [db, userId]
  );

  const handleNewChat = useCallback(() => {
    startNewChat();
    setView("chat");
  }, []);

  const handleBackFromChat = useCallback(() => {
    cancelActiveStream();
    setView("list");
  }, []);

  switch (view) {
    case "chat":
      return <ChatScreen onBack={handleBackFromChat} onNewChat={handleNewChat} />;
    case "list":
      return (
        <ConversationList
          onSelectSession={(id) => {
            void handleSelectSession(id);
          }}
          onNewChat={handleNewChat}
        />
      );
  }
}
