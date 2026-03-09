import type { ChatSession } from "../schema";

const MAX_TITLE_LENGTH = 50;

export function deriveConversationTitle(firstMessage: string): string {
  if (firstMessage.length <= MAX_TITLE_LENGTH) return firstMessage;
  return `${firstMessage.slice(0, MAX_TITLE_LENGTH)}...`;
}

export function findExpiredSessions(
  sessions: readonly ChatSession[],
  now: string
): readonly ChatSession[] {
  return sessions.filter((s) => s.deletedAt === null && s.expiresAt < now);
}
