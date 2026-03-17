import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { create } from "zustand";
import { type AnyDb, chatMessages, chatSessions, getSupabase } from "@/shared/db";
import { captureError, generateId } from "@/shared/lib";
import { deriveConversationTitle, findExpiredSessions } from "./lib/sessions";
import type { ActionStatus, ChatAction, ChatMessage, ChatSession, UserMemory } from "./schema";
import { extractMemories } from "./services/ai-chat-api";

let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type ChatState = {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  memories: UserMemory[];
  isStreaming: boolean;
  streamingContent: string;
  expiredSessionCount: number;
};

type ChatActions = {
  initStore: (db: AnyDb, userId: string) => void;
  loadSessions: () => Promise<void>;
  createSession: (firstMessage: string) => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  addUserMessage: (content: string) => Promise<ChatMessage>;
  addAssistantMessage: (content: string, action?: ChatAction | null) => Promise<ChatMessage>;
  updateActionStatus: (messageId: string, status: ActionStatus) => Promise<void>;
  setStreaming: (isStreaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  loadMemories: () => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  extractAndSaveMemories: () => Promise<void>;
  cleanupExpiredSessions: () => Promise<readonly ChatSession[]>;
  dismissExpiredBanner: () => void;
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  memories: [],
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
      memories: [],
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
    const id = generateId("cs");
    const now = new Date();
    const session: ChatSession = {
      id,
      userId: userIdRef,
      title: deriveConversationTitle(firstMessage),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS).toISOString(),
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
    const now = new Date().toISOString();
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
        action: r.action ? JSON.parse(r.action) : null,
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
      id: generateId("cm"),
      sessionId: currentSessionId,
      role: "user",
      content,
      action: null,
      actionStatus: null,
      createdAt: new Date().toISOString(),
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
      id: generateId("cm"),
      sessionId: currentSessionId,
      role: "assistant",
      content,
      action,
      actionStatus,
      createdAt: new Date().toISOString(),
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

  loadMemories: async () => {
    if (!userIdRef) return;
    const userId = userIdRef;
    const { data, error } = await getSupabase()
      .from("user_memories")
      .select("id, fact, category, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      captureError(error);
      return;
    }
    if (!data) return;
    set({
      memories: data.map(
        // biome-ignore lint/style/useNamingConvention: Supabase column name
        (r: { id: string; fact: string; category: string; created_at: string }) => ({
          id: r.id,
          userId,
          fact: r.fact,
          category: r.category as UserMemory["category"],
          createdAt: r.created_at,
          updatedAt: r.created_at,
        })
      ),
    });
  },

  deleteMemory: async (id) => {
    const { error } = await getSupabase()
      .from("user_memories")
      // biome-ignore lint/style/useNamingConvention: Supabase column name
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      captureError(error);
      return;
    }
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
  },

  extractAndSaveMemories: async () => {
    if (!userIdRef) return;
    const userId = userIdRef;
    const { messages } = get();
    if (messages.length < 2) return;

    const conversationMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const saved = await extractMemories(conversationMessages);
    if (saved.length === 0) return;

    set((state) => ({
      memories: [
        ...state.memories,
        ...saved.map((s) => ({
          id: s.id,
          userId,
          fact: s.fact,
          category: s.category as UserMemory["category"],
          createdAt: s.created_at,
          updatedAt: s.created_at,
        })),
      ],
    }));
  },

  cleanupExpiredSessions: async () => {
    if (!dbRef) return [];
    const db = dbRef;
    const { sessions } = get();
    const now = new Date().toISOString();
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
