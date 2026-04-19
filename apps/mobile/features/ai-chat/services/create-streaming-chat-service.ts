import { Effect } from "effect";
import type { AnyDb } from "@/shared/db";
import { fromPromise, fromThunk, makeAppTag, runWithService } from "@/shared/effect/runtime";
import type { ChatSessionId, UserId } from "@/shared/types/branded";
import type { ChatAction, ChatMessage } from "../schema";

type StreamChatMessage = Pick<ChatMessage, "role" | "content">;

type StreamCallbacks = {
  readonly onChunk: (text: string) => void;
  readonly onDone: () => void;
  readonly onError: (error: string) => void;
};

type StreamingChatState = {
  readonly isStreaming: boolean;
  readonly currentSessionId: ChatSessionId | null;
  readonly messages: readonly ChatMessage[];
};

type SendMessageInput = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
  readonly text: string;
  readonly executeAction: (action: ChatAction) => Promise<void>;
};

type CreateStreamingChatServiceDeps = {
  readonly getState: () => StreamingChatState;
  readonly setStreaming: (isStreaming: boolean) => void;
  readonly setStreamingContent: (content: string) => void;
  readonly streamChat: (
    messages: readonly StreamChatMessage[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) => Promise<void>;
  readonly createChatSession: (db: AnyDb, userId: UserId, firstMessage: string) => Promise<unknown>;
  readonly addUserChatMessage: (db: AnyDb, userId: UserId, content: string) => Promise<unknown>;
  readonly addAssistantChatMessage: (
    db: AnyDb,
    userId: UserId,
    content: string,
    action?: ChatAction | null
  ) => Promise<unknown>;
  readonly parseActionFromResponse: (content: string) => ChatAction | null;
  readonly trackAiMessageSent: () => void | Promise<void>;
  readonly captureWarning: (
    name: "ai_action_failed",
    tags: {
      actionType: ChatAction["type"];
      errorType: string;
    }
  ) => void | Promise<void>;
  readonly captureError: (error: unknown) => void | Promise<void>;
};

export type StreamingChatService = {
  readonly sendMessage: (input: SendMessageInput) => Promise<void>;
  readonly cancel: () => void;
};

type StreamingRuntime = {
  activeController: AbortController | null;
};

type ReadySendMessageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly text: string;
  readonly executeAction: (action: ChatAction) => Promise<void>;
};

const StreamingChatDeps = makeAppTag<CreateStreamingChatServiceDeps>(
  "@/features/ai-chat/StreamingChatDeps"
);

function resetStreamState(runtime: StreamingRuntime, deps: CreateStreamingChatServiceDeps): void {
  deps.setStreaming(false);
  deps.setStreamingContent("");
  runtime.activeController = null;
}

function toConversation(
  messages: readonly ChatMessage[],
  text: string
): readonly StreamChatMessage[] {
  return [
    ...messages.map((message) => ({ role: message.role, content: message.content })),
    { role: "user" as const, content: text },
  ];
}

async function handleStreamDone(
  deps: CreateStreamingChatServiceDeps,
  input: ReadySendMessageInput,
  controller: AbortController,
  accumulated: string
): Promise<void> {
  if (controller.signal.aborted) return;

  const action = deps.parseActionFromResponse(accumulated);
  await deps.addAssistantChatMessage(input.db, input.userId, accumulated, action);

  if (action?.type === "add") {
    try {
      await input.executeAction(action);
    } catch (actionErr) {
      await deps.captureWarning("ai_action_failed", {
        actionType: action.type,
        errorType: actionErr instanceof Error ? actionErr.message : "unknown",
      });
    }
  }
}

async function handleStreamError(
  deps: CreateStreamingChatServiceDeps,
  input: ReadySendMessageInput,
  controller: AbortController,
  accumulated: string,
  error: string
): Promise<void> {
  if (controller.signal.aborted) return;

  const errorMessage =
    accumulated || `I'm sorry, something went wrong. Please try again. (${error})`;
  await deps.addAssistantChatMessage(input.db, input.userId, errorMessage);
}

async function runStreamLifecycle(
  runtime: StreamingRuntime,
  deps: CreateStreamingChatServiceDeps,
  input: ReadySendMessageInput,
  conversation: readonly StreamChatMessage[],
  controller: AbortController
): Promise<void> {
  let accumulated = "";
  let settled = false;

  const settle = (handler: () => Promise<void>, resolve: () => void): void => {
    if (settled) return;
    settled = true;
    void handler()
      .catch((error) => deps.captureError(error))
      .finally(() => {
        resetStreamState(runtime, deps);
        resolve();
      });
  };

  await new Promise<void>((resolve) => {
    void deps
      .streamChat(
        conversation,
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            deps.setStreamingContent(accumulated);
          },
          onDone: () => {
            settle(() => handleStreamDone(deps, input, controller, accumulated), resolve);
          },
          onError: (error) => {
            settle(() => handleStreamError(deps, input, controller, accumulated, error), resolve);
          },
        },
        controller.signal
      )
      .then(() => {
        if (controller.signal.aborted) {
          if (!settled) {
            settled = true;
            resetStreamState(runtime, deps);
            resolve();
          }
          return;
        }

        if (!settled) {
          settle(() => handleStreamDone(deps, input, controller, accumulated), resolve);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          if (!settled) {
            settled = true;
            resetStreamState(runtime, deps);
            resolve();
          }
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown error";
        settle(() => handleStreamError(deps, input, controller, accumulated, message), resolve);
      });
  });
}

function sendMessageEffect(input: SendMessageInput, runtime: StreamingRuntime) {
  return Effect.gen(function* () {
    const trimmed = input.text.trim();
    if (!trimmed || !input.db || !input.userId) return;
    const db = input.db;
    const userId = input.userId;

    const deps = yield* StreamingChatDeps;
    const state = deps.getState();
    if (state.isStreaming) return;

    if (!state.currentSessionId) {
      yield* fromPromise(() => deps.createChatSession(db, userId, trimmed));
    }

    if (!deps.getState().currentSessionId) return;

    const conversation = toConversation(deps.getState().messages, trimmed);

    yield* fromPromise(() => deps.addUserChatMessage(db, userId, trimmed));
    yield* fromThunk(() => deps.trackAiMessageSent());
    yield* fromThunk(() => {
      deps.setStreaming(true);
      deps.setStreamingContent("");
    });

    const controller = new AbortController();
    runtime.activeController = controller;

    yield* fromPromise(() =>
      runStreamLifecycle(
        runtime,
        deps,
        {
          db,
          userId,
          text: trimmed,
          executeAction: input.executeAction,
        },
        conversation,
        controller
      )
    );
  });
}

export function createStreamingChatService(
  deps: CreateStreamingChatServiceDeps
): StreamingChatService {
  const runtime: StreamingRuntime = { activeController: null };

  return {
    sendMessage: (input) =>
      runWithService(sendMessageEffect(input, runtime), StreamingChatDeps, deps).catch((error) =>
        Promise.resolve(deps.captureError(error)).then(() => {
          resetStreamState(runtime, deps);
        })
      ),
    cancel: () => {
      runtime.activeController?.abort();
      resetStreamState(runtime, deps);
    },
  };
}
