import { useCallback, useState } from "react";
import { ChatScreen } from "@/features/ai-chat/components/ChatScreen";
import { ConversationList } from "@/features/ai-chat/components/ConversationList";
import { MemoryManager } from "@/features/ai-chat/components/MemoryManager";
import { cancelActiveStream } from "@/features/ai-chat/hooks/use-streaming-chat";
import { useChatStore } from "@/features/ai-chat/store";

type AiView = "list" | "chat" | "memories";

export default function AiTab() {
  const [view, setView] = useState<AiView>("list");
  const selectSession = useChatStore((s) => s.selectSession);
  const extractAndSaveMemories = useChatStore((s) => s.extractAndSaveMemories);

  const handleSelectSession = useCallback(
    async (id: string) => {
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
    extractAndSaveMemories().catch(() => {});
    setView("list");
  }, [extractAndSaveMemories]);

  const handleOpenMemories = useCallback(() => {
    setView("memories");
  }, []);

  const handleBackFromMemories = useCallback(() => {
    setView("list");
  }, []);

  switch (view) {
    case "chat":
      return <ChatScreen onBack={handleBackFromChat} />;
    case "memories":
      return <MemoryManager onBack={handleBackFromMemories} />;
    default:
      return (
        <ConversationList
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onOpenMemories={handleOpenMemories}
        />
      );
  }
}
