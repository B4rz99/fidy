import type { AnyDb } from "@/shared/db";
import {
  type AppTelemetry,
  bindAppTelemetry,
  captureErrorEffect,
  captureWarningEffect,
} from "@/shared/effect/telemetry";
import type { UserId } from "@/shared/types/branded";
import type { ChatAction } from "../schema";
import {
  type ActiveStreamRun,
  beginStreamRun,
  canPersistRun,
  createActiveStreamRun,
  createStreamCallbacks,
  createStreamRecorder,
  hasActiveStream,
  type ReadySendMessageInput,
  resetStreamState,
  resetStreamStateIfCurrent,
  type SendMessageInput,
  type StreamChatMessage,
  type StreamingRuntime,
  type StreamRecorder,
  type StreamStateDeps,
  setStreamOutcome,
  toConversation,
  toReadySendMessageInput,
  toThrownErrorMessage,
} from "./streaming-chat-service/runtime";

type CreateStreamingChatServiceDeps = StreamStateDeps & {
  readonly streamChat: (
    messages: readonly StreamChatMessage[],
    callbacks: {
      readonly onChunk: (text: string) => void;
      readonly onDone: () => void;
      readonly onError: (error: string) => void;
    },
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
  readonly telemetry?: AppTelemetry;
};

export type StreamingChatService = {
  readonly sendMessage: (input: SendMessageInput) => Promise<void>;
  readonly cancel: () => void;
};

type StreamingTelemetry = {
  readonly captureError: (error: unknown) => Promise<void>;
  readonly captureWarning: (
    name: "ai_action_failed",
    tags: {
      actionType: ChatAction["type"];
      errorType: string;
    }
  ) => Promise<void>;
};

const ensureCurrentSession = async (
  deps: CreateStreamingChatServiceDeps,
  request: ReadySendMessageInput
): Promise<boolean> => {
  if (deps.getState().currentSessionId) return true;
  await deps.createChatSession(request.db, request.userId, request.text);
  return deps.getState().currentSessionId !== null;
};

async function buildConversation(
  deps: CreateStreamingChatServiceDeps,
  request: ReadySendMessageInput
): Promise<readonly StreamChatMessage[] | null> {
  const hasSession = await ensureCurrentSession(deps, request);
  if (!hasSession) return null;
  return toConversation(deps.getState().messages, request.text);
}

async function prepareStreamingRun(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>
): Promise<void> {
  await run.deps.addUserChatMessage(run.request.db, run.request.userId, run.request.text);
  await run.deps.trackAiMessageSent();
  run.deps.setStreaming(true);
  run.deps.setStreamingContent("");
}

async function consumeStream(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  conversation: readonly StreamChatMessage[],
  recorder: StreamRecorder
): Promise<void> {
  try {
    await run.deps.streamChat(
      conversation,
      createStreamCallbacks(run, recorder),
      run.controller.signal
    );
  } catch (error) {
    if (run.controller.signal.aborted) return;
    setStreamOutcome(recorder, { type: "error", message: toThrownErrorMessage(error) });
  }
}

async function executeAddAction(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  action: Extract<ChatAction, { type: "add" }>
) {
  try {
    await run.request.executeAction(action);
  } catch (actionErr) {
    await run.telemetry.captureWarning("ai_action_failed", {
      actionType: action.type,
      errorType: actionErr instanceof Error ? actionErr.message : "unknown",
    });
  }
}

async function persistAssistantMessage(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  content: string,
  action: ChatAction | null
): Promise<void> {
  await run.deps.addAssistantChatMessage(run.request.db, run.request.userId, content, action);
}

async function persistDoneOutcome(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  content: string
): Promise<void> {
  const action = run.deps.parseActionFromResponse(content);
  await persistAssistantMessage(run, content, action);
  if (action?.type !== "add") return;
  await executeAddAction(run, action);
}

async function persistErrorOutcome(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  accumulated: string,
  error: string
): Promise<void> {
  const content = accumulated || `I'm sorry, something went wrong. Please try again. (${error})`;
  await run.deps.addAssistantChatMessage(run.request.db, run.request.userId, content);
}

async function persistStreamOutcome(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  recorder: StreamRecorder
): Promise<void> {
  if (!canPersistRun(run)) return;
  const outcome = recorder.outcome ?? { type: "done" as const };
  if (outcome.type === "error") {
    await persistErrorOutcome(run, recorder.accumulated, outcome.message);
    return;
  }
  await persistDoneOutcome(run, recorder.accumulated);
}

async function runStreamLifecycle(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>,
  conversation: readonly StreamChatMessage[]
): Promise<void> {
  const recorder = createStreamRecorder();
  try {
    await consumeStream(run, conversation, recorder);
    if (run.controller.signal.aborted) return;
    await persistStreamOutcome(run, recorder);
  } finally {
    resetStreamStateIfCurrent(run);
  }
}

async function startStreamingRun(
  run: ActiveStreamRun<CreateStreamingChatServiceDeps, StreamingTelemetry>
): Promise<void> {
  const conversation = await buildConversation(run.deps, run.request);
  if (!conversation) {
    resetStreamStateIfCurrent(run);
    return;
  }
  await prepareStreamingRun(run);
  await runStreamLifecycle(run, conversation);
}

export function createStreamingChatService(
  deps: CreateStreamingChatServiceDeps
): StreamingChatService {
  const { telemetry } = deps;
  const telemetryRuntime = bindAppTelemetry(telemetry);
  const streamingTelemetry: StreamingTelemetry = {
    captureError: (error) => telemetryRuntime.run(captureErrorEffect(error)),
    captureWarning: (message, tags) => telemetryRuntime.run(captureWarningEffect(message, tags)),
  };
  const runtime: StreamingRuntime = {
    lastRunId: 0,
    currentRunId: null,
    activeController: null,
  };

  async function sendMessage(input: SendMessageInput): Promise<void> {
    const request = toReadySendMessageInput(input);
    if (!request || hasActiveStream(deps.getState(), runtime)) return;

    const runId = beginStreamRun(runtime);
    const run = createActiveStreamRun({
      deps,
      telemetry: streamingTelemetry,
      runtime,
      request,
      runId,
    });

    try {
      await startStreamingRun(run);
    } catch (error) {
      await streamingTelemetry.captureError(error);
      resetStreamStateIfCurrent(run);
    }
  }

  function cancel(): void {
    runtime.activeController?.abort();
    resetStreamState(runtime, deps);
  }

  return { sendMessage, cancel };
}
