import { describe, expect, it, vi } from "vitest";
import {
  createActiveStreamRun,
  createStreamCallbacks,
  createStreamRecorder,
  resetStreamState,
  type StreamingChatState,
  type StreamingRuntime,
  toReadySendMessageInput,
} from "@/features/ai-chat/services/streaming-chat-service/runtime";
import { requireUserId } from "@/shared/types/assertions";

const USER_ID = requireUserId("user-1");
const mockDb = {} as never;

const createStateDeps = () => {
  let state: StreamingChatState & { streamingContent: string } = {
    isStreaming: false,
    currentSessionId: null,
    messages: [],
    streamingContent: "",
  };

  return {
    deps: {
      getState: () => state,
      setStreaming: (isStreaming: boolean) => {
        state = { ...state, isStreaming };
      },
      setStreamingContent: (streamingContent: string) => {
        state = { ...state, streamingContent };
      },
    },
    getSnapshot: () => state,
  };
};

describe("streaming chat runtime", () => {
  it("trims valid input and rejects empty or missing request fields", () => {
    const executeAction = vi.fn();

    expect(
      toReadySendMessageInput({
        db: mockDb,
        userId: USER_ID,
        text: "  hello  ",
        executeAction,
      })
    ).toMatchObject({ db: mockDb, userId: USER_ID, text: "hello", executeAction });

    expect(
      toReadySendMessageInput({
        db: mockDb,
        userId: USER_ID,
        text: "   ",
        executeAction,
      })
    ).toBeNull();
    expect(
      toReadySendMessageInput({
        db: null,
        userId: USER_ID,
        text: "hello",
        executeAction,
      })
    ).toBeNull();
  });

  it("records stream chunks only for the current run", () => {
    const state = createStateDeps();
    const runtime: StreamingRuntime = {
      lastRunId: 1,
      currentRunId: 2,
      activeController: null,
    };
    const run = createActiveStreamRun({
      deps: state.deps,
      telemetry: {},
      runtime,
      request: {
        db: mockDb,
        userId: USER_ID,
        text: "hello",
        executeAction: vi.fn(),
      },
      runId: 1,
    });
    const recorder = createStreamRecorder();
    const callbacks = createStreamCallbacks(run, recorder);

    callbacks.onChunk("ignored");
    callbacks.onDone();

    expect(state.getSnapshot().streamingContent).toBe("");
    expect(recorder.accumulated).toBe("");
    expect(recorder.outcome).toEqual({ type: "done" });
  });

  it("clears runtime and streaming content on reset", () => {
    const state = createStateDeps();
    const runtime: StreamingRuntime = {
      lastRunId: 1,
      currentRunId: 1,
      activeController: new AbortController(),
    };

    state.deps.setStreaming(true);
    state.deps.setStreamingContent("partial");

    resetStreamState(runtime, state.deps);

    expect(runtime.currentRunId).toBeNull();
    expect(runtime.activeController).toBeNull();
    expect(state.getSnapshot()).toMatchObject({
      isStreaming: false,
      streamingContent: "",
    });
  });
});
