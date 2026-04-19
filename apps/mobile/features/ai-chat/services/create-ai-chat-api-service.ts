import { Effect } from "effect";
import { fetch as expoFetch } from "expo/fetch";
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
    signal?: AbortSignal
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

export function createAiChatApiService({
  fetchImpl = expoFetch,
  getBaseUrl = () => process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabase,
  telemetry,
}: CreateAiChatApiServiceDeps = {}): AiChatApiService {
  const supabaseRuntime = bindAppSupabase(supabase);
  const telemetryRuntime = bindAppTelemetry(telemetry);
  const runSupabaseEffect = <A>(effect: Effect.Effect<A, unknown, AppSupabase>) =>
    supabaseRuntime.run(effect);
  const captureCallbackError = (error: unknown) =>
    telemetryRuntime.run(captureErrorEffect(error)).catch(() => undefined);

  return {
    async streamChat(messages, callbacks, signal) {
      const headers = await runSupabaseEffect(authHeadersEffect());
      const url = `${getBaseUrl()}/functions/v1/ai-chat`;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ messages }),
          signal,
        });
      } catch (error) {
        if (signal?.aborted) return;
        callbacks.onError(error instanceof Error ? error.message : "Network error");
        return;
      }

      if (!response.ok) {
        callbacks.onError(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      // FP exemption: streaming SSE requires imperative buffering.
      let buffer = "";

      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional streaming loop
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();

            if (payload === "[DONE]") {
              callbacks.onDone();
              return;
            }

            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              if (parsed.error) {
                callbacks.onError(String(parsed.error));
                return;
              }
              if (parsed.content) {
                try {
                  callbacks.onChunk(String(parsed.content));
                } catch (callbackError) {
                  void captureCallbackError(callbackError);
                }
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        callbacks.onDone();
      } catch (error) {
        if (signal?.aborted) return;
        callbacks.onError(error instanceof Error ? error.message : "Stream error");
      }
    },
  };
}
