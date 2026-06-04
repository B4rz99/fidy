import { Effect } from "effect";
import { fetch as expoFetch } from "expo/fetch";
import type { FinancialContextPacket } from "@/features/advisor/public";
import { fromPromise } from "@/shared/effect/runtime";
import {
  type AppSupabase,
  bindAppSupabase,
  currentSupabaseClientEffect,
} from "@/shared/effect/supabase";
import { type AppTelemetry, bindAppTelemetry, captureErrorEffect } from "@/shared/effect/telemetry";

type ChatMessage = { readonly role: "user" | "assistant"; readonly content: string };

type StreamCallbacks = {
  readonly onChunk: (text: string) => void;
  readonly onDone: () => void;
  readonly onError: (error: string) => void;
};

type StreamChatOptions = {
  readonly signal?: AbortSignal;
  readonly financialContextPacket?: FinancialContextPacket;
};

type CreateAiChatApiServiceDeps = {
  readonly fetchImpl?: typeof expoFetch;
  readonly getBaseUrl?: () => string;
  readonly supabase?: AppSupabase;
  readonly telemetry?: AppTelemetry;
};

export type AiChatApiService = {
  readonly streamChat: (
    messages: readonly ChatMessage[],
    callbacks: StreamCallbacks,
    options?: StreamChatOptions
  ) => Promise<void>;
};

function authHeadersEffect() {
  return Effect.flatMap(currentSupabaseClientEffect, (supabase) =>
    Effect.map(
      fromPromise(() => supabase.auth.getSession()),
      ({ data }) =>
        ({
          // biome-ignore lint/style/useNamingConvention: HTTP header name
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        }) satisfies Record<string, string>
    )
  );
}

async function resolveAuthHeaders(input: {
  readonly runSupabaseEffect: <A>(effect: Effect.Effect<A, unknown, AppSupabase>) => Promise<A>;
  readonly callbacks: StreamCallbacks;
  readonly signal?: AbortSignal;
}): Promise<Record<string, string> | null> {
  try {
    return await input.runSupabaseEffect(authHeadersEffect());
  } catch (error) {
    if (!input.signal?.aborted) {
      input.callbacks.onError(error instanceof Error ? error.message : "Auth error");
    }
    return null;
  }
}

async function postChat(input: {
  readonly fetchImpl: typeof expoFetch;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly messages: readonly ChatMessage[];
  readonly financialContextPacket?: FinancialContextPacket;
  readonly signal?: AbortSignal;
  readonly callbacks: StreamCallbacks;
}): Promise<Response | null> {
  try {
    return await input.fetchImpl(input.url, {
      method: "POST",
      headers: input.headers,
      body: JSON.stringify({
        messages: input.messages,
        financialContextPacket: input.financialContextPacket,
      }),
      signal: input.signal,
    });
  } catch (error) {
    if (!input.signal?.aborted) {
      input.callbacks.onError(error instanceof Error ? error.message : "Network error");
    }
    return null;
  }
}

type SsePayloadResult = "continue" | "done";

function emitChunk(input: {
  readonly callbacks: StreamCallbacks;
  readonly captureCallbackError: (error: unknown) => void;
  readonly content: unknown;
}): void {
  try {
    input.callbacks.onChunk(String(input.content));
  } catch (callbackError) {
    input.captureCallbackError(callbackError);
  }
}

function handleSsePayload(input: {
  readonly payload: string;
  readonly callbacks: StreamCallbacks;
  readonly captureCallbackError: (error: unknown) => void;
}): SsePayloadResult {
  if (input.payload === "[DONE]") {
    input.callbacks.onDone();
    return "done";
  }

  try {
    const parsed = JSON.parse(input.payload) as Record<string, unknown>;
    if (parsed.error) {
      input.callbacks.onError(String(parsed.error));
      return "done";
    }
    if (parsed.content) {
      emitChunk({ ...input, content: parsed.content });
    }
  } catch {
    // Skip malformed SSE lines
  }
  return "continue";
}

function processSseLines(
  lines: readonly string[],
  input: {
    readonly callbacks: StreamCallbacks;
    readonly captureCallbackError: (error: unknown) => void;
  }
): SsePayloadResult {
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const result = handleSsePayload({
      payload: line.slice(6).trim(),
      callbacks: input.callbacks,
      captureCallbackError: input.captureCallbackError,
    });
    if (result === "done") return "done";
  }
  return "continue";
}

async function readSsePayloads(input: {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly callbacks: StreamCallbacks;
  readonly captureCallbackError: (error: unknown) => void;
}): Promise<SsePayloadResult> {
  const decoder = new TextDecoder();
  // FP exemption: streaming SSE requires imperative buffering.
  let buffer = "";

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional streaming loop
  while (true) {
    const { done, value } = await input.reader.read();
    if (done) return "continue";

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    if (processSseLines(lines, input) === "done") return "done";
  }
}

function finishSseStream(result: SsePayloadResult, callbacks: StreamCallbacks): void {
  if (result === "continue") {
    callbacks.onDone();
  }
}

function streamErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Stream error";
}

function isAbortSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function notifySseStreamError(
  input: {
    readonly callbacks: StreamCallbacks;
    readonly signal?: AbortSignal;
  },
  error: unknown
): void {
  if (isAbortSignalAborted(input.signal)) return;
  input.callbacks.onError(streamErrorMessage(error));
}

async function consumeSseStream(input: {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly callbacks: StreamCallbacks;
  readonly signal?: AbortSignal;
  readonly captureCallbackError: (error: unknown) => void;
}): Promise<void> {
  try {
    finishSseStream(await readSsePayloads(input), input.callbacks);
  } catch (error) {
    notifySseStreamError(input, error);
  }
}

function getStreamReader(
  response: Response,
  callbacks: StreamCallbacks
): ReadableStreamDefaultReader<Uint8Array> | null {
  if (!response.ok) {
    callbacks.onError(`HTTP ${response.status}`);
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return null;
  }
  return reader;
}

async function openChatStream(input: {
  readonly runSupabaseEffect: <A>(effect: Effect.Effect<A, unknown, AppSupabase>) => Promise<A>;
  readonly fetchImpl: typeof expoFetch;
  readonly url: string;
  readonly messages: readonly ChatMessage[];
  readonly financialContextPacket?: FinancialContextPacket;
  readonly callbacks: StreamCallbacks;
  readonly signal?: AbortSignal;
}): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
  const headers = await resolveAuthHeaders(input);
  if (!headers) return null;

  const response = await postChat({ ...input, headers });
  if (!response) return null;

  return getStreamReader(response, input.callbacks);
}

export function createAiChatApiService({
  fetchImpl = expoFetch,
  getBaseUrl = () => process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabase,
  telemetry,
}: CreateAiChatApiServiceDeps = {}): AiChatApiService {
  const supabaseRuntime = bindAppSupabase(supabase);
  const telemetryRuntime = bindAppTelemetry(telemetry);
  function runSupabaseEffect<A>(effect: Effect.Effect<A, unknown, AppSupabase>) {
    return supabaseRuntime.run(effect);
  }
  const captureCallbackError = (error: unknown) =>
    telemetryRuntime.run(captureErrorEffect(error)).catch(() => undefined);

  return {
    async streamChat(messages, callbacks, options) {
      const { signal, financialContextPacket } = options ?? {};
      const reader = await openChatStream({
        runSupabaseEffect,
        fetchImpl,
        url: `${getBaseUrl()}/functions/v1/ai-chat`,
        messages,
        financialContextPacket,
        callbacks,
        signal,
      });
      if (!reader) return;

      await consumeSseStream({ reader, callbacks, signal, captureCallbackError });
    },
  };
}
