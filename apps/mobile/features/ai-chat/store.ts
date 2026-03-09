import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import { chatMessages, chatSessions, userMemories } from "@/shared/db/schema";
import { generateId } from "@/shared/lib/generate-id";
import { deduplicateMemories } from "./lib/memories";
import { deriveConversationTitle, findExpiredSessions } from "./lib/sessions";
import type {
  ActionStatus,
  ChatAction,
  ChatMessage,
  ChatSession,
  ExtractedMemory,
  UserMemory,
} from "./schema";
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
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  memories: [],
  isStreaming: false,
  streamingContent: "",

  initStore: (db, userId) => {
    dbRef = db;
    userIdRef = userId;
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
      ? action.type === "delete"
        ? "pending"
        : "confirmed"
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
    if (!dbRef || !userIdRef) return;
    const rows = await dbRef.select().from(userMemories).where(eq(userMemories.userId, userIdRef));

    set({
      memories: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        fact: r.fact,
        category: r.category as UserMemory["category"],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  },

  deleteMemory: async (id) => {
    if (!dbRef) return;
    await dbRef.delete(userMemories).where(eq(userMemories.id, id));
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    }));
  },

  extractAndSaveMemories: async () => {
    if (!dbRef || !userIdRef) return;
    const db = dbRef;
    const userId = userIdRef;
    const { messages, memories } = get();
    if (messages.length < 2) return;

    const conversationMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const extracted: readonly ExtractedMemory[] = await extractMemories(conversationMessages);
    if (extracted.length === 0) return;

    const newFacts = deduplicateMemories(memories, extracted);
    if (newFacts.length === 0) return;

    const now = new Date().toISOString();
    const newMemories: UserMemory[] = newFacts.map((f) => ({
      id: generateId("um"),
      userId,
      fact: f.fact,
      category: f.category,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(userMemories).values(
      newMemories.map((m) => ({
        id: m.id,
        userId: m.userId,
        fact: m.fact,
        category: m.category,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))
    );

    set((state) => ({
      memories: [...state.memories, ...newMemories],
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
      set((state) => ({
        sessions: state.sessions.filter((s) => !expiredIds.has(s.id)),
      }));
    }

    return expired;
  },
}));
