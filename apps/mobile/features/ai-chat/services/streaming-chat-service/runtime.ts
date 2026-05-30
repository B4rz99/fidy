import type { AnyDb } from "@/shared/db";
import type { ChatSessionId, UserId } from "@/shared/types/branded";
import type { ChatAction, ChatMessage } from "../../schema";

export type StreamChatMessage = Pick<ChatMessage, "role" | "content">;

export type StreamCallbacks = {
  readonly onChunk: (text: string) => void;
  readonly onDone: () => void;
  readonly onError: (error: string) => void;
};

export type StreamingChatState = {
  readonly isStreaming: boolean;
  readonly currentSessionId: ChatSessionId | null;
  readonly messages: readonly ChatMessage[];
};

export type SendMessageInput = {
  readonly db: AnyDb | null;
  readonly userId: UserId | null;
  readonly text: string;
  readonly executeAction: (action: ChatAction) => Promise<void>;
};

export type ReadySendMessageInput = {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly text: string;
  readonly executeAction: (action: ChatAction) => Promise<void>;
};

export type StreamingRuntime = {
  lastRunId: number;
  currentRunId: number | null;
  activeController: AbortController | null;
};

export type StreamOutcome =
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

export type StreamRecorder = {
  accumulated: string;
  outcome: StreamOutcome | null;
};

export type StreamStateDeps = {
  readonly getState: () => StreamingChatState;
  readonly setStreaming: (isStreaming: boolean) => void;
  readonly setStreamingContent: (content: string) => void;
};

export type ActiveStreamRun<Deps extends StreamStateDeps, Telemetry> = {
  readonly deps: Deps;
  readonly telemetry: Telemetry;
  readonly runtime: StreamingRuntime;
  readonly request: ReadySendMessageInput;
  readonly runId: number;
  readonly controller: AbortController;
};

export type ActiveStreamRunArgs<Deps extends StreamStateDeps, Telemetry> = {
  readonly deps: Deps;
  readonly telemetry: Telemetry;
  readonly runtime: StreamingRuntime;
  readonly request: ReadySendMessageInput;
  readonly runId: number;
};

type CurrentStreamRun = {
  readonly runtime: StreamingRuntime;
  readonly runId: number;
};

export const beginStreamRun = (runtime: StreamingRuntime): number => {
  const runId = runtime.lastRunId + 1;
  runtime.lastRunId = runId;
  runtime.currentRunId = runId;
  return runId;
};

export const toReadySendMessageInput = (input: SendMessageInput): ReadySendMessageInput | null => {
  const text = input.text.trim();
  if (!text || !input.db || !input.userId) {
    return null;
  }

  return {
    db: input.db,
    userId: input.userId,
    text,
    executeAction: input.executeAction,
  };
};

export const hasActiveStream = (state: StreamingChatState, runtime: StreamingRuntime): boolean =>
  state.isStreaming || runtime.currentRunId !== null;

export function createActiveStreamRun<Deps extends StreamStateDeps, Telemetry>(
  args: ActiveStreamRunArgs<Deps, Telemetry>
): ActiveStreamRun<Deps, Telemetry> {
  const controller = new AbortController();
  args.runtime.activeController = controller;

  return {
    ...args,
    controller,
  };
}

const isCurrentRun = (run: CurrentStreamRun): boolean => run.runtime.currentRunId === run.runId;

export function resetStreamState<Deps extends StreamStateDeps>(
  runtime: StreamingRuntime,
  deps: Deps
): void {
  deps.setStreaming(false);
  deps.setStreamingContent("");
  runtime.activeController = null;
  runtime.currentRunId = null;
}

export function resetStreamStateIfCurrent<Deps extends StreamStateDeps, Telemetry>(
  run: ActiveStreamRun<Deps, Telemetry>
): void {
  if (!isCurrentRun(run)) {
    return;
  }

  resetStreamState(run.runtime, run.deps);
}

export function canPersistRun<Deps extends StreamStateDeps, Telemetry>(
  run: ActiveStreamRun<Deps, Telemetry>
): boolean {
  return !run.controller.signal.aborted && isCurrentRun(run);
}

export const toConversation = (
  messages: readonly ChatMessage[],
  text: string
): readonly StreamChatMessage[] => [
  ...messages.map((message) => ({ role: message.role, content: message.content })),
  { role: "user" as const, content: text },
];

export function createStreamRecorder(): StreamRecorder {
  return {
    accumulated: "",
    outcome: null,
  };
}

export function setStreamOutcome(recorder: StreamRecorder, outcome: StreamOutcome): void {
  if (recorder.outcome) {
    return;
  }

  recorder.outcome = outcome;
}

function recordStreamChunk<Deps extends StreamStateDeps, Telemetry>(
  run: ActiveStreamRun<Deps, Telemetry>,
  recorder: StreamRecorder,
  chunk: string
): void {
  if (!isCurrentRun(run)) {
    return;
  }

  recorder.accumulated += chunk;
  run.deps.setStreamingContent(recorder.accumulated);
}

export function createStreamCallbacks<Deps extends StreamStateDeps, Telemetry>(
  run: ActiveStreamRun<Deps, Telemetry>,
  recorder: StreamRecorder
): StreamCallbacks {
  return {
    onChunk: (chunk) => recordStreamChunk(run, recorder, chunk),
    onDone: () => setStreamOutcome(recorder, { type: "done" }),
    onError: (error) => setStreamOutcome(recorder, { type: "error", message: error }),
  };
}

export const toThrownErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";
