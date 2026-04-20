import type { AnyDb } from "@/shared/db";
import {
  type AppTelemetry,
  bindAppTelemetry,
  captureErrorEffect,
  captureWarningEffect,
} from "@/shared/effect/telemetry";
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
  readonly telemetry?: AppTelemetry;
};

export type StreamingChatService = {
  readonly sendMessage: (input: SendMessageInput) => Promise<void>;
  readonly cancel: () => void;
};

type StreamingRuntime = {
  lastRunId: number;
  currentRunId: number | null;
  activeController: AbortController | null;
};

type ReadySendMessageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly text: string;
  readonly executeAction: (action: ChatAction) => Promise<void>;
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

type StreamOutcome =
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

type ActiveStreamRun = {
  readonly deps: CreateStreamingChatServiceDeps;
  readonly telemetry: StreamingTelemetry;
  readonly runtime: StreamingRuntime;
  readonly request: ReadySendMessageInput;
  readonly runId: number;
  readonly controller: AbortController;
};

type ActiveStreamRunArgs = {
  readonly deps: CreateStreamingChatServiceDeps;
  readonly telemetry: StreamingTelemetry;
  readonly runtime: StreamingRuntime;
  readonly request: ReadySendMessageInput;
  readonly runId: number;
};

type CurrentStreamRun = {
  readonly runtime: StreamingRuntime;
  readonly runId: number;
};

type StreamRecorder = {
  accumulated: string;
  outcome: StreamOutcome | null;
};

const beginStreamRun = (runtime: StreamingRuntime): number => {
  const runId = runtime.lastRunId + 1;
  runtime.lastRunId = runId;
  runtime.currentRunId = runId;
  return runId;
};

const toReadySendMessageInput = (input: SendMessageInput): ReadySendMessageInput | null => {
  const text = input.text.trim();
  if (!text || !input.db || !input.userId) return null;
  return {
    db: input.db,
    userId: input.userId,
    text,
    executeAction: input.executeAction,
  };
};

const hasActiveStream = (state: StreamingChatState, runtime: StreamingRuntime): boolean =>
  state.isStreaming || runtime.currentRunId !== null;

const createActiveStreamRun = (args: ActiveStreamRunArgs): ActiveStreamRun => {
  const controller = new AbortController();
  args.runtime.activeController = controller;
  return {
    ...args,
    controller,
  };
};

const isCurrentRun = (run: CurrentStreamRun): boolean => run.runtime.currentRunId === run.runId;

const resetStreamState = (
  runtime: StreamingRuntime,
  deps: CreateStreamingChatServiceDeps
): void => {
  deps.setStreaming(false);
  deps.setStreamingContent("");
  runtime.activeController = null;
  runtime.currentRunId = null;
};

const resetStreamStateIfCurrent = (run: ActiveStreamRun): void => {
  if (!isCurrentRun(run)) return;
  resetStreamState(run.runtime, run.deps);
};

const canPersistRun = (run: ActiveStreamRun): boolean =>
  !run.controller.signal.aborted && isCurrentRun(run);

const toConversation = (
  messages: readonly ChatMessage[],
  text: string
): readonly StreamChatMessage[] => [
  ...messages.map((message) => ({ role: message.role, content: message.content })),
  { role: "user" as const, content: text },
];

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

async function prepareStreamingRun(run: ActiveStreamRun): Promise<void> {
  await run.deps.addUserChatMessage(run.request.db, run.request.userId, run.request.text);
  await run.deps.trackAiMessageSent();
  run.deps.setStreaming(true);
  run.deps.setStreamingContent("");
}

function createStreamRecorder(): StreamRecorder {
  return {
    accumulated: "",
    outcome: null,
  };
}

function setStreamOutcome(recorder: StreamRecorder, outcome: StreamOutcome): void {
  if (recorder.outcome) return;
  recorder.outcome = outcome;
}

function recordStreamChunk(run: ActiveStreamRun, recorder: StreamRecorder, chunk: string): void {
  if (!isCurrentRun(run)) return;
  recorder.accumulated += chunk;
  run.deps.setStreamingContent(recorder.accumulated);
}

function createStreamCallbacks(run: ActiveStreamRun, recorder: StreamRecorder): StreamCallbacks {
  return {
    onChunk: (chunk) => recordStreamChunk(run, recorder, chunk),
    onDone: () => setStreamOutcome(recorder, { type: "done" }),
    onError: (error) => setStreamOutcome(recorder, { type: "error", message: error }),
  };
}

function toThrownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function consumeStream(
  run: ActiveStreamRun,
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
  run: ActiveStreamRun,
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
  run: ActiveStreamRun,
  content: string,
  action: ChatAction | null
): Promise<void> {
  await run.deps.addAssistantChatMessage(run.request.db, run.request.userId, content, action);
}

async function persistDoneOutcome(run: ActiveStreamRun, content: string): Promise<void> {
  const action = run.deps.parseActionFromResponse(content);
  await persistAssistantMessage(run, content, action);
  if (action?.type !== "add") return;
  await executeAddAction(run, action);
}

async function persistErrorOutcome(
  run: ActiveStreamRun,
  accumulated: string,
  error: string
): Promise<void> {
  const content = accumulated || `I'm sorry, something went wrong. Please try again. (${error})`;
  await run.deps.addAssistantChatMessage(run.request.db, run.request.userId, content);
}

async function persistStreamOutcome(run: ActiveStreamRun, recorder: StreamRecorder): Promise<void> {
  if (!canPersistRun(run)) return;
  const outcome = recorder.outcome ?? { type: "done" as const };
  if (outcome.type === "error") {
    await persistErrorOutcome(run, recorder.accumulated, outcome.message);
    return;
  }
  await persistDoneOutcome(run, recorder.accumulated);
}

async function runStreamLifecycle(
  run: ActiveStreamRun,
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

async function startStreamingRun(run: ActiveStreamRun): Promise<void> {
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
