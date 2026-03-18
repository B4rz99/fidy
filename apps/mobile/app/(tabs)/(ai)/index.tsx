import { useCallback, useState } from "react";
import { ChatScreen, ConversationList, cancelActiveStream, useChatStore } from "@/features/ai-chat";
import { captureError } from "@/shared/lib";

type AiView = "list" | "chat";

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

  switch (view) {
    case "chat":
      return <ChatScreen onBack={handleBackFromChat} />;
    default:
      return <ConversationList onSelectSession={handleSelectSession} onNewChat={handleNewChat} />;
  }
}
