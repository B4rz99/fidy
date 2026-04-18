import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { create } from "zustand";
import { type AnyDb, chatMessages, chatSessions } from "@/shared/db";
import { generateChatMessageId, generateChatSessionId, toIsoDateTime } from "@/shared/lib";
import { requireIsoDateTime } from "@/shared/types/assertions";
import type { ChatMessageId, ChatSessionId, UserId } from "@/shared/types/branded";
import { deriveConversationTitle, findExpiredSessions } from "./lib/sessions";
import type { ActionStatus, ChatAction, ChatMessage, ChatSession } from "./schema";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

let chatStoreSessionId = 0;
let loadChatSessionsRequestId = 0;
let selectChatSessionRequestId = 0;

type ChatState = {
  readonly activeUserId: UserId | null;
  readonly sessions: readonly ChatSession[];
  readonly currentSessionId: ChatSessionId | null;
  readonly messages: readonly ChatMessage[];
  readonly isStreaming: boolean;
  readonly streamingContent: string;
  readonly expiredSessionCount: number;
};

type ChatActions = {
  beginSession: (userId: UserId) => void;
  setSessions: (sessions: readonly ChatSession[]) => void;
  prependSession: (session: ChatSession) => void;
  removeSession: (sessionId: ChatSessionId) => void;
  setCurrentSessionId: (sessionId: ChatSessionId | null) => void;
  setMessages: (messages: readonly ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  setMessageActionStatus: (messageId: ChatMessageId, status: ActionStatus) => void;
  setStreaming: (isStreaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  setExpiredSessionCount: (count: number) => void;
  clearCurrentConversation: () => void;
  dismissExpiredBanner: () => void;
};

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  activeUserId: null,
  sessions: [],
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  expiredSessionCount: 0,

  beginSession: (userId) =>
    set({
      activeUserId: userId,
      sessions: [],
      currentSessionId: null,
      messages: [],
      isStreaming: false,
      streamingContent: "",
      expiredSessionCount: 0,
    }),

  setSessions: (sessions) => set({ sessions: [...sessions] }),

  prependSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSessionId: session.id,
      messages: [],
    })),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId),
      currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
      messages: state.currentSessionId === sessionId ? [] : state.messages,
    })),

  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),

  setMessages: (messages) => set({ messages: [...messages] }),

  appendMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessageActionStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, actionStatus: status } : message
      ),
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setStreamingContent: (streamingContent) => set({ streamingContent }),

  setExpiredSessionCount: (expiredSessionCount) => set({ expiredSessionCount }),

  clearCurrentConversation: () =>
    set({
      currentSessionId: null,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    }),

  dismissExpiredBanner: () => set({ expiredSessionCount: 0 }),
}));

function isActiveChatSession(userId: UserId, sessionId: number): boolean {
  return chatStoreSessionId === sessionId && useChatStore.getState().activeUserId === userId;
}

function isCurrentLoadSessionsRequest(
  requestId: number,
  userId: UserId,
  sessionId: number
): boolean {
  return loadChatSessionsRequestId === requestId && isActiveChatSession(userId, sessionId);
}

function isCurrentSelectSessionRequest(
  requestId: number,
  userId: UserId,
  sessionId: number,
  chatSessionId: ChatSessionId
): boolean {
  return (
    selectChatSessionRequestId === requestId &&
    isActiveChatSession(userId, sessionId) &&
    useChatStore.getState().currentSessionId === chatSessionId
  );
}

function mapChatSessionRow(row: {
  id: ChatSessionId;
  userId: UserId;
  title: string;
  createdAt: string;
  expiresAt: string;
  deletedAt: string | null;
}): ChatSession {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    createdAt: requireIsoDateTime(row.createdAt),
    expiresAt: requireIsoDateTime(row.expiresAt),
    deletedAt: row.deletedAt ? requireIsoDateTime(row.deletedAt) : null,
  };
}

function mapChatMessageRow(row: {
  id: ChatMessageId;
  sessionId: ChatSessionId;
  role: string;
  content: string;
  action: string | null;
  actionStatus: string | null;
  createdAt: string;
}): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as "user" | "assistant",
    content: row.content,
    action: row.action ? (JSON.parse(row.action) as ChatAction) : null,
    actionStatus: row.actionStatus as ActionStatus | null,
    createdAt: requireIsoDateTime(row.createdAt),
  };
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
  const rows = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)))
    .orderBy(desc(chatSessions.createdAt));

  if (!isCurrentLoadSessionsRequest(requestId, userId, sessionId)) return;
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
  useChatStore.getState().setCurrentSessionId(id);

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(asc(chatMessages.createdAt));

  if (!isCurrentSelectSessionRequest(requestId, userId, sessionId, id)) return;
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

export async function updateChatActionStatus(
  db: AnyDb,
  userId: UserId,
  messageId: ChatMessageId,
  status: ActionStatus
): Promise<void> {
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
