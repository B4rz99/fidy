import { useCallback, useState } from "react";
import { ChatScreen, ConversationList, cancelActiveStream, useChatStore } from "@/features/ai-chat";
import { captureError } from "@/shared/lib";
import type { ChatSessionId } from "@/shared/types/branded";

type AiView = "list" | "chat";

export default function AiTab() {
  const [view, setView] = useState<AiView>("list");
  const selectSession = useChatStore((s) => s.selectSession);
  const extractAndSaveMemories = useChatStore((s) => s.extractAndSaveMemories);

  const handleSelectSession = useCallback(
    async (id: ChatSessionId) => {
      await selectSession(id);
      setView("chat");
    },
    [selectSession]
  );

  const handleNewChat = useCallback(() => {
    useChatStore.setState({ currentSessionId: null, messages: [] });
    setView("chat");
  }, []);

  const handleBackFromChat = useCallback(() => {
    cancelActiveStream();
    extractAndSaveMemories().catch(captureError);
    setView("list");
  }, [extractAndSaveMemories]);

  switch (view) {
    case "chat":
      return <ChatScreen onBack={handleBackFromChat} />;
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
