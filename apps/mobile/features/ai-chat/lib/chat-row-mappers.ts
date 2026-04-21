import type { chatMessages, chatSessions } from "@/shared/db";
import { requireIsoDateTime } from "@/shared/types/assertions";
import type { ActionStatus, ChatAction, ChatMessage, ChatSession } from "../schema";

const parseChatAction = (action: string | null): ChatAction | null => {
  if (action === null) {
    return null;
  }

  try {
    return JSON.parse(action) as ChatAction;
  } catch {
    return null;
  }
};

export function mapChatSessionRow(row: typeof chatSessions.$inferSelect): ChatSession {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    createdAt: requireIsoDateTime(row.createdAt),
    expiresAt: requireIsoDateTime(row.expiresAt),
    deletedAt: row.deletedAt ? requireIsoDateTime(row.deletedAt) : null,
  };
}

export function mapChatMessageRow(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as "user" | "assistant",
    content: row.content,
    action: parseChatAction(row.action),
    actionStatus: row.actionStatus as ActionStatus | null,
    createdAt: requireIsoDateTime(row.createdAt),
  };
}
