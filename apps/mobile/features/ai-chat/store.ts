import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { create } from "zustand";
import { type AnyDb, chatMessages, chatSessions } from "@/shared/db";
import { generateChatMessageId, generateChatSessionId, toIsoDateTime } from "@/shared/lib";
import type { ChatMessageId, ChatSessionId, UserId } from "@/shared/types/branded";
import { deriveConversationTitle, findExpiredSessions } from "./lib/sessions";
import type { ActionStatus, ChatAction, ChatMessage, ChatSession } from "./schema";

let dbRef: AnyDb | null = null;
let userIdRef: UserId | null = null;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type ChatState = {
  sessions: ChatSession[];
  currentSessionId: ChatSessionId | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  expiredSessionCount: number;
};

type ChatActions = {
  initStore: (db: AnyDb, userId: UserId) => void;
  loadSessions: () => Promise<void>;
  createSession: (firstMessage: string) => Promise<ChatSessionId>;
  deleteSession: (id: ChatSessionId) => Promise<void>;
  selectSession: (id: ChatSessionId) => Promise<void>;
  addUserMessage: (content: string) => Promise<ChatMessage>;
  addAssistantMessage: (content: string, action?: ChatAction | null) => Promise<ChatMessage>;
  updateActionStatus: (messageId: ChatMessageId, status: ActionStatus) => Promise<void>;
  setStreaming: (isStreaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  cleanupExpiredSessions: () => Promise<readonly ChatSession[]>;
  dismissExpiredBanner: () => void;
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  expiredSessionCount: 0,

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
    set({
      sessions: [],
      currentSessionId: null,
      messages: [],
      expiredSessionCount: 0,
    });
  },

  loadSessions: async () => {
    if (!dbRef || !userIdRef) return;
    const rows = await dbRef
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.userId, userIdRef), isNull(chatSessions.deletedAt)))
      .orderBy(desc(chatSessions.createdAt));

    set({
      sessions: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        deletedAt: r.deletedAt,
      })),
    });
  },

  createSession: async (firstMessage) => {
    if (!dbRef || !userIdRef) throw new Error("Store not initialized");
    const id = generateChatSessionId();
    const now = new Date();
    const nowIso = toIsoDateTime(now);
    const expiresIso = toIsoDateTime(new Date(now.getTime() + THIRTY_DAYS_MS));
    const session: ChatSession = {
      id,
      userId: userIdRef,
      title: deriveConversationTitle(firstMessage),
      createdAt: nowIso,
      expiresAt: expiresIso,
      deletedAt: null,
    };

    await dbRef.insert(chatSessions).values({
      id: session.id,
      userId: session.userId,
      title: session.title,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      deletedAt: null,
    });

    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSessionId: id,
      messages: [],
    }));
    return id;
  },

  deleteSession: async (id) => {
    if (!dbRef) return;
    const now = toIsoDateTime(new Date());
    await dbRef.update(chatSessions).set({ deletedAt: now }).where(eq(chatSessions.id, id));

    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      messages: state.currentSessionId === id ? [] : state.messages,
    }));
  },

  selectSession: async (id) => {
    if (!dbRef) return;
    const rows = await dbRef
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(asc(chatMessages.createdAt));

    set({
      currentSessionId: id,
      messages: rows.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role as "user" | "assistant",
        content: r.content,
        action: r.action ? (JSON.parse(r.action) as ChatAction) : null,
        actionStatus: r.actionStatus as ActionStatus | null,
        createdAt: r.createdAt,
      })),
    });
  },

  addUserMessage: async (content) => {
    if (!dbRef) throw new Error("Store not initialized");
    const { currentSessionId } = get();
    if (!currentSessionId) throw new Error("No active session");

    const msg: ChatMessage = {
      id: generateChatMessageId(),
      sessionId: currentSessionId,
      role: "user",
      content,
      action: null,
      actionStatus: null,
      createdAt: toIsoDateTime(new Date()),
    };

    await dbRef.insert(chatMessages).values({
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      action: null,
      actionStatus: null,
      createdAt: msg.createdAt,
    });

    set((state) => ({ messages: [...state.messages, msg] }));
    return msg;
  },

  addAssistantMessage: async (content, action = null) => {
    if (!dbRef) throw new Error("Store not initialized");
    const { currentSessionId } = get();
    if (!currentSessionId) throw new Error("No active session");

    const actionStatus: ActionStatus | null = action
      ? action.type === "add"
        ? "confirmed"
        : action.type === "delete"
          ? "pending"
          : null
      : null;

    const msg: ChatMessage = {
      id: generateChatMessageId(),
      sessionId: currentSessionId,
      role: "assistant",
      content,
      action,
      actionStatus,
      createdAt: toIsoDateTime(new Date()),
    };

    await dbRef.insert(chatMessages).values({
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      action: action ? JSON.stringify(action) : null,
      actionStatus: msg.actionStatus,
      createdAt: msg.createdAt,
    });

    set((state) => ({ messages: [...state.messages, msg] }));
    return msg;
  },

  updateActionStatus: async (messageId, status) => {
    if (!dbRef) return;
    await dbRef
      .update(chatMessages)
      .set({ actionStatus: status })
      .where(eq(chatMessages.id, messageId));

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, actionStatus: status } : m
      ),
    }));
  },

  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingContent: (streamingContent) => set({ streamingContent }),

  cleanupExpiredSessions: async () => {
    if (!dbRef) return [];
    const db = dbRef;
    const { sessions } = get();
    const now = toIsoDateTime(new Date());
    const expired = findExpiredSessions(sessions, now);

    await Promise.all(
      expired.map((s) =>
        db.update(chatSessions).set({ deletedAt: now }).where(eq(chatSessions.id, s.id))
      )
    );

    if (expired.length > 0) {
      const expiredIds = new Set(expired.map((s) => s.id));
      set((state) => {
        const isActiveExpired = state.currentSessionId
          ? expiredIds.has(state.currentSessionId)
          : false;
        return {
          sessions: state.sessions.filter((s) => !expiredIds.has(s.id)),
          expiredSessionCount: expired.length,
          ...(isActiveExpired ? { currentSessionId: null, messages: [] } : {}),
        };
      });
    }

    return expired;
  },

  dismissExpiredBanner: () => set({ expiredSessionCount: 0 }),
}));
