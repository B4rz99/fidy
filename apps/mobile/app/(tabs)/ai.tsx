import { useCallback, useState } from "react";
import { cancelActiveStream, ChatScreen, ConversationList, MemoryManager, useChatStore } from "@/features/ai-chat";
import { captureError } from "@/shared/lib";

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
    extractAndSaveMemories().catch(captureError);
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
