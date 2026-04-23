import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { create } from "zustand";
import { type AnyDb, chatMessages, chatSessions } from "@/shared/db";
import { generateChatMessageId, generateChatSessionId, toIsoDateTime } from "@/shared/lib";
import type { ChatMessageId, ChatSessionId, UserId } from "@/shared/types/branded";
import { mapChatMessageRow, mapChatSessionRow } from "./lib/chat-row-mappers";
import { deriveConversationTitle, findExpiredSessions } from "./lib/sessions";
import type { ActionStatus, ChatAction, ChatMessage, ChatSession } from "./schema";
import { createChatStoreState } from "./store/state";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let chatStoreSessionId = 0;
let loadChatSessionsRequestId = 0;
let selectChatSessionRequestId = 0;
type UpdateChatActionStatusInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly messageId: ChatMessageId;
  readonly status: ActionStatus;
};

export const useChatStore = create(createChatStoreState);

function isActiveChatSession(userId: UserId, sessionId: number): boolean {
  return chatStoreSessionId === sessionId && useChatStore.getState().activeUserId === userId;
}

export function initializeChatSession(userId: UserId): void {
  chatStoreSessionId += 1;
  loadChatSessionsRequestId += 1;
  selectChatSessionRequestId += 1;
  useChatStore.getState().beginSession(userId);
}

export function startNewChat(): void {
  useChatStore.getState().clearCurrentConversation();
}

export async function loadChatSessions(db: AnyDb, userId: UserId): Promise<void> {
  const requestId = ++loadChatSessionsRequestId;
  const sessionId = chatStoreSessionId;
  const isCurrentRequest = () =>
    loadChatSessionsRequestId === requestId && isActiveChatSession(userId, sessionId);
  const rows = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)))
    .orderBy(desc(chatSessions.createdAt));

  if (!isCurrentRequest()) return;
  useChatStore.getState().setSessions(rows.map(mapChatSessionRow));
}

export async function createChatSession(
  db: AnyDb,
  userId: UserId,
  firstMessage: string
): Promise<ChatSessionId> {
  const sessionId = chatStoreSessionId;
  if (!isActiveChatSession(userId, sessionId)) {
    throw new Error("Chat store not initialized");
  }

  const id = generateChatSessionId();
  const now = new Date();
  const nowIso = toIsoDateTime(now);
  const expiresIso = toIsoDateTime(new Date(now.getTime() + THIRTY_DAYS_MS));
  const session: ChatSession = {
    id,
    userId,
    title: deriveConversationTitle(firstMessage),
    createdAt: nowIso,
    expiresAt: expiresIso,
    deletedAt: null,
  };

  if (!isActiveChatSession(userId, sessionId)) return id;

  await db.insert(chatSessions).values({
    id: session.id,
    userId: session.userId,
    title: session.title,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    deletedAt: null,
  });

  if (isActiveChatSession(userId, sessionId)) {
    useChatStore.getState().prependSession(session);
  }
  return id;
}

export async function deleteChatSession(
  db: AnyDb,
  userId: UserId,
  id: ChatSessionId
): Promise<void> {
  const sessionId = chatStoreSessionId;
  if (!isActiveChatSession(userId, sessionId)) return;

  const now = toIsoDateTime(new Date());
  await db.update(chatSessions).set({ deletedAt: now }).where(eq(chatSessions.id, id));

  if (!isActiveChatSession(userId, sessionId)) return;
  useChatStore.getState().removeSession(id);
}

export async function selectChatSession(
  db: AnyDb,
  userId: UserId,
  id: ChatSessionId
): Promise<void> {
  const requestId = ++selectChatSessionRequestId;
  const sessionId = chatStoreSessionId;
  const isCurrentRequest = () =>
    selectChatSessionRequestId === requestId &&
    isActiveChatSession(userId, sessionId) &&
    useChatStore.getState().currentSessionId === id;
  useChatStore.getState().setCurrentSessionId(id);

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(asc(chatMessages.createdAt));

  if (!isCurrentRequest()) return;
  useChatStore.getState().setMessages(rows.map(mapChatMessageRow));
}

export async function addUserChatMessage(
  db: AnyDb,
  userId: UserId,
  content: string
): Promise<ChatMessage> {
  const sessionId = chatStoreSessionId;
  if (!isActiveChatSession(userId, sessionId)) {
    throw new Error("Chat store not initialized");
  }
  const currentSessionId = useChatStore.getState().currentSessionId;
  if (!currentSessionId) throw new Error("No active session");

  const message: ChatMessage = {
    id: generateChatMessageId(),
    sessionId: currentSessionId,
    role: "user",
    content,
    action: null,
    actionStatus: null,
    createdAt: toIsoDateTime(new Date()),
  };

  if (!isActiveChatSession(userId, sessionId)) return message;

  await db.insert(chatMessages).values({
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    action: null,
    actionStatus: null,
    createdAt: message.createdAt,
  });

  if (isActiveChatSession(userId, sessionId)) {
    useChatStore.getState().appendMessage(message);
  }
  return message;
}

export async function addAssistantChatMessage(
  db: AnyDb,
  userId: UserId,
  content: string,
  action: ChatAction | null = null
): Promise<ChatMessage> {
  const sessionId = chatStoreSessionId;
  if (!isActiveChatSession(userId, sessionId)) {
    throw new Error("Chat store not initialized");
  }
  const currentSessionId = useChatStore.getState().currentSessionId;
  if (!currentSessionId) throw new Error("No active session");

  const actionStatus: ActionStatus | null = action
    ? action.type === "add"
      ? "confirmed"
      : action.type === "delete"
        ? "pending"
        : null
    : null;

  const message: ChatMessage = {
    id: generateChatMessageId(),
    sessionId: currentSessionId,
    role: "assistant",
    content,
    action,
    actionStatus,
    createdAt: toIsoDateTime(new Date()),
  };

  if (!isActiveChatSession(userId, sessionId)) return message;

  await db.insert(chatMessages).values({
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    action: action ? JSON.stringify(action) : null,
    actionStatus: message.actionStatus,
    createdAt: message.createdAt,
  });

  if (isActiveChatSession(userId, sessionId)) {
    useChatStore.getState().appendMessage(message);
  }
  return message;
}

export async function updateChatActionStatus(input: UpdateChatActionStatusInput): Promise<void> {
  const { db, userId, messageId, status } = input;
  const sessionId = chatStoreSessionId;
  if (!isActiveChatSession(userId, sessionId)) return;

  await db.update(chatMessages).set({ actionStatus: status }).where(eq(chatMessages.id, messageId));

  if (!isActiveChatSession(userId, sessionId)) return;
  useChatStore.getState().setMessageActionStatus(messageId, status);
}

export async function cleanupExpiredChatSessions(
  db: AnyDb,
  userId: UserId
): Promise<readonly ChatSession[]> {
  const sessionId = chatStoreSessionId;
  if (!isActiveChatSession(userId, sessionId)) return [];

  const sessions = useChatStore.getState().sessions;
  const now = toIsoDateTime(new Date());
  const expired = findExpiredSessions(sessions, now);

  await Promise.all(
    expired.map((session) =>
      db.update(chatSessions).set({ deletedAt: now }).where(eq(chatSessions.id, session.id))
    )
  );

  if (!isActiveChatSession(userId, sessionId) || expired.length === 0) {
    return expired;
  }

  const expiredIds = new Set(expired.map((session) => session.id));
  useChatStore.setState((state) => {
    const isActiveExpired = state.currentSessionId ? expiredIds.has(state.currentSessionId) : false;
    return {
      sessions: state.sessions.filter((session) => !expiredIds.has(session.id)),
      expiredSessionCount: expired.length,
      ...(isActiveExpired ? { currentSessionId: null, messages: [] } : {}),
    };
  });

  return expired;
}

export function dismissExpiredChatBanner(): void {
  useChatStore.getState().dismissExpiredBanner();
}
