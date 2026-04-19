import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatAction, ChatMessage } from "@/features/ai-chat/schema";
import { createStreamingChatService } from "@/features/ai-chat/services/create-streaming-chat-service";
import { requireCategoryId, requireUserId } from "@/shared/types/assertions";
import type { ChatSessionId, IsoDateTime } from "@/shared/types/branded";

const USER_ID = requireUserId("user-1");
const mockDb = {} as never;

function makeAssistantMessage(content: string): ChatMessage {
  return {
    id: "message-1" as never,
    sessionId: "chat-1" as ChatSessionId,
    role: "assistant",
    content,
    action: null,
    actionStatus: null,
    createdAt: "2026-04-18T10:15:00.000Z" as IsoDateTime,
  };
}

function makeAddAction(): ChatAction {
  return {
    type: "add",
    data: {
      type: "expense",
      amount: 50000,
      categoryId: requireCategoryId("food"),
      description: "Lunch",
      date: "2026-04-18" as never,
    },
  };
}

function createState() {
  let state: {
    isStreaming: boolean;
    currentSessionId: ChatSessionId | null;
    messages: readonly ChatMessage[];
    streamingContent: string;
  } = {
    isStreaming: false,
    currentSessionId: null,
    messages: [],
    streamingContent: "",
  };

  return {
    getState: () => state,
    setStreaming: (isStreaming: boolean) => {
      state = { ...state, isStreaming };
    },
    setStreamingContent: (streamingContent: string) => {
      state = { ...state, streamingContent };
    },
    setCurrentSessionId: (currentSessionId: ChatSessionId | null) => {
      state = { ...state, currentSessionId };
    },
    appendMessage: (message: ChatMessage) => {
      state = { ...state, messages: [...state.messages, message] };
    },
  };
}

describe("streaming chat service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a session, streams the reply, executes add actions, and resets stream state", async () => {
    const state = createState();
    const executeAction = vi.fn().mockResolvedValue(undefined);
    const createChatSession = vi.fn().mockImplementation(async () => {
      state.setCurrentSessionId("chat-1" as ChatSessionId);
      return "chat-1" as ChatSessionId;
    });
    const addUserChatMessage = vi.fn().mockImplementation(async () => {
      state.appendMessage({
        id: "message-user" as never,
        sessionId: "chat-1" as ChatSessionId,
        role: "user",
        content: "hello",
        action: null,
        actionStatus: null,
        createdAt: "2026-04-18T10:10:00.000Z" as IsoDateTime,
      });
    });
    const addAssistantChatMessage = vi.fn().mockResolvedValue(makeAssistantMessage("hello back"));
    const trackAiMessageSent = vi.fn();
    const captureWarning = vi.fn();
    const captureError = vi.fn();

    const service = createStreamingChatService({
      getState: state.getState,
      setStreaming: state.setStreaming,
      setStreamingContent: state.setStreamingContent,
      streamChat: async (_messages, callbacks) => {
        callbacks.onChunk("hello");
        callbacks.onChunk(" back");
        callbacks.onDone();
      },
      createChatSession,
      addUserChatMessage,
      addAssistantChatMessage,
      parseActionFromResponse: () => makeAddAction(),
      trackAiMessageSent,
      captureWarning,
      captureError,
    });

    await service.sendMessage({
      db: mockDb,
      userId: USER_ID,
      text: "hello",
      executeAction,
    });

    expect(createChatSession).toHaveBeenCalledWith(mockDb, USER_ID, "hello");
    expect(addUserChatMessage).toHaveBeenCalledWith(mockDb, USER_ID, "hello");
    expect(trackAiMessageSent).toHaveBeenCalled();
    expect(addAssistantChatMessage).toHaveBeenCalledWith(
      mockDb,
      USER_ID,
      "hello back",
      makeAddAction()
    );
    expect(executeAction).toHaveBeenCalledWith(makeAddAction());
    expect(captureWarning).not.toHaveBeenCalled();
    expect(state.getState()).toMatchObject({
      isStreaming: false,
      streamingContent: "",
    });
  });

  it("captures action failures without breaking the assistant reply", async () => {
    const state = createState();
    state.setCurrentSessionId("chat-1" as ChatSessionId);
    const executeAction = vi.fn().mockRejectedValue(new Error("action failed"));
    const captureWarning = vi.fn();

    const service = createStreamingChatService({
      getState: state.getState,
      setStreaming: state.setStreaming,
      setStreamingContent: state.setStreamingContent,
      streamChat: async (_messages, callbacks) => {
        callbacks.onChunk("reply");
        callbacks.onDone();
      },
      createChatSession: vi.fn(),
      addUserChatMessage: vi.fn().mockResolvedValue(undefined),
      addAssistantChatMessage: vi.fn().mockResolvedValue(makeAssistantMessage("reply")),
      parseActionFromResponse: () => makeAddAction(),
      trackAiMessageSent: vi.fn(),
      captureWarning,
      captureError: vi.fn(),
    });

    await service.sendMessage({
      db: mockDb,
      userId: USER_ID,
      text: "hello",
      executeAction,
    });

    expect(captureWarning).toHaveBeenCalledWith("ai_action_failed", {
      actionType: "add",
      errorType: "action failed",
    });
  });

  it("persists an assistant error message when the stream reports an error", async () => {
    const state = createState();
    state.setCurrentSessionId("chat-1" as ChatSessionId);
    const addAssistantChatMessage = vi.fn().mockResolvedValue(makeAssistantMessage("partial"));

    const service = createStreamingChatService({
      getState: state.getState,
      setStreaming: state.setStreaming,
      setStreamingContent: state.setStreamingContent,
      streamChat: async (_messages, callbacks) => {
        callbacks.onChunk("partial");
        callbacks.onError("boom");
      },
      createChatSession: vi.fn(),
      addUserChatMessage: vi.fn().mockResolvedValue(undefined),
      addAssistantChatMessage,
      parseActionFromResponse: () => null,
      trackAiMessageSent: vi.fn(),
      captureWarning: vi.fn(),
      captureError: vi.fn(),
    });

    await service.sendMessage({
      db: mockDb,
      userId: USER_ID,
      text: "hello",
      executeAction: vi.fn(),
    });

    expect(addAssistantChatMessage).toHaveBeenCalledWith(mockDb, USER_ID, "partial");
    expect(state.getState()).toMatchObject({
      isStreaming: false,
      streamingContent: "",
    });
  });

  it("aborts the active stream and resets state on cancel", async () => {
    const state = createState();
    state.setCurrentSessionId("chat-1" as ChatSessionId);
    let capturedSignal: AbortSignal | undefined;
    let resolveStarted: (() => void) | null = null;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });

    const service = createStreamingChatService({
      getState: state.getState,
      setStreaming: state.setStreaming,
      setStreamingContent: state.setStreamingContent,
      streamChat: (_messages, _callbacks, signal) =>
        new Promise<void>((resolve) => {
          capturedSignal = signal;
          resolveStarted?.();
          signal?.addEventListener("abort", () => resolve());
        }),
      createChatSession: vi.fn(),
      addUserChatMessage: vi.fn().mockResolvedValue(undefined),
      addAssistantChatMessage: vi.fn().mockResolvedValue(makeAssistantMessage("reply")),
      parseActionFromResponse: () => null,
      trackAiMessageSent: vi.fn(),
      captureWarning: vi.fn(),
      captureError: vi.fn(),
    });

    const sendPromise = service.sendMessage({
      db: mockDb,
      userId: USER_ID,
      text: "hello",
      executeAction: vi.fn(),
    });

    await started;
    service.cancel();
    await sendPromise;

    expect(capturedSignal?.aborted).toBe(true);
    expect(state.getState()).toMatchObject({
      isStreaming: false,
      streamingContent: "",
    });
  });

  it("does not let a canceled stream clear a newer stream when it settles later", async () => {
    const state = createState();
    state.setCurrentSessionId("chat-1" as ChatSessionId);
    let firstSignal: AbortSignal | undefined;
    let secondSignal: AbortSignal | undefined;
    let resolveFirst: (() => void) | null = null;
    let resolveSecond: (() => void) | null = null;
    let resolveFirstStarted: (() => void) | null = null;
    let resolveSecondStarted: (() => void) | null = null;
    const firstStarted = new Promise<void>((resolve) => {
      resolveFirstStarted = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      resolveSecondStarted = resolve;
    });
    let invocation = 0;

    const service = createStreamingChatService({
      getState: state.getState,
      setStreaming: state.setStreaming,
      setStreamingContent: state.setStreamingContent,
      streamChat: (_messages, callbacks, signal) => {
        invocation += 1;

        if (invocation === 1) {
          return new Promise<void>((resolve) => {
            firstSignal = signal;
            resolveFirst = resolve;
            resolveFirstStarted?.();
          });
        }

        return new Promise<void>((resolve) => {
          secondSignal = signal;
          callbacks.onChunk("new stream");
          resolveSecond = resolve;
          resolveSecondStarted?.();
          signal?.addEventListener("abort", () => resolve());
        });
      },
      createChatSession: vi.fn(),
      addUserChatMessage: vi.fn().mockResolvedValue(undefined),
      addAssistantChatMessage: vi.fn().mockResolvedValue(makeAssistantMessage("reply")),
      parseActionFromResponse: () => null,
      trackAiMessageSent: vi.fn(),
      captureWarning: vi.fn(),
      captureError: vi.fn(),
    });

    const firstSend = service.sendMessage({
      db: mockDb,
      userId: USER_ID,
      text: "first",
      executeAction: vi.fn(),
    });

    await firstStarted;
    service.cancel();

    const secondSend = service.sendMessage({
      db: mockDb,
      userId: USER_ID,
      text: "second",
      executeAction: vi.fn(),
    });

    await secondStarted;
    expect(firstSignal?.aborted).toBe(true);
    expect(state.getState()).toMatchObject({
      isStreaming: true,
      streamingContent: "new stream",
    });

    resolveFirst!();
    await firstSend;

    expect(secondSignal?.aborted).toBe(false);
    expect(state.getState()).toMatchObject({
      isStreaming: true,
      streamingContent: "new stream",
    });

    service.cancel();
    await secondSend;
    resolveSecond!();

    expect(secondSignal?.aborted).toBe(true);
    expect(state.getState()).toMatchObject({
      isStreaming: false,
      streamingContent: "",
    });
  });
});
