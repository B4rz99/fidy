import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type { AuthenticatedBootstrapContext } from "@/shared/bootstrap/types";
import { handleRecoverableError } from "@/shared/lib";
import { cleanupExpiredChatSessions, initializeChatSession, loadChatSessions } from "./public";

export const aiChatBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "ai-chat",
  run: ({ db, userId }) => {
    initializeChatSession(userId);
    void loadChatSessions(db, userId)
      .then(() => cleanupExpiredChatSessions(db, userId))
      .catch(handleRecoverableError("Failed to load chat sessions"));
  },
};
