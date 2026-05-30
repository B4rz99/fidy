import type { StateCreator } from "zustand";
import type { ChatMessageId, ChatSessionId, UserId } from "@/shared/types/branded";
import type { ActionStatus, ChatMessage, ChatSession } from "../schema";

export type ChatState = {
  readonly activeUserId: UserId | null;
  readonly sessions: readonly ChatSession[];
  readonly currentSessionId: ChatSessionId | null;
  readonly messages: readonly ChatMessage[];
  readonly isStreaming: boolean;
  readonly streamingContent: string;
  readonly expiredSessionCount: number;
};

export type ChatActions = {
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

export type ChatStore = ChatState & ChatActions;
type ChatSetState = Parameters<StateCreator<ChatStore>>[0];

export function createChatState(activeUserId: UserId | null): ChatState {
  return {
    activeUserId,
    sessions: [],
    currentSessionId: null,
    messages: [],
    isStreaming: false,
    streamingContent: "",
    expiredSessionCount: 0,
  };
}

function beginChatSession(set: ChatSetState): ChatActions["beginSession"] {
  return (userId) => set(createChatState(userId));
}

function prependChatSession(set: ChatSetState): ChatActions["prependSession"] {
  return (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSessionId: session.id,
      messages: [],
    }));
}

function removeChatSession(set: ChatSetState): ChatActions["removeSession"] {
  return (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId),
      currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
      messages: state.currentSessionId === sessionId ? [] : state.messages,
    }));
}

function setChatMessageActionStatus(set: ChatSetState): ChatActions["setMessageActionStatus"] {
  return (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, actionStatus: status } : message
      ),
    }));
}

function createChatActions(set: ChatSetState): ChatActions {
  return {
    beginSession: beginChatSession(set),
    setSessions: (sessions) => set({ sessions: [...sessions] }),
    prependSession: prependChatSession(set),
    removeSession: removeChatSession(set),
    setCurrentSessionId: (currentSessionId) => set({ currentSessionId, messages: [] }),
    setMessages: (messages) => set({ messages: [...messages] }),
    appendMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),
    setMessageActionStatus: setChatMessageActionStatus(set),
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
  };
}

export const createChatStoreState: StateCreator<ChatStore> = (set) => ({
  ...createChatState(null),
  ...createChatActions(set),
});
