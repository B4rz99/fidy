import { getSupabase } from "@/shared/lib/supabase";
import type { ExtractedMemory } from "../schema";

type ChatMessage = { readonly role: "user" | "assistant"; readonly content: string };
type ChatContext = {
  readonly transactions: readonly unknown[];
  readonly summary: unknown;
  readonly memories: readonly { readonly fact: string; readonly category: string }[];
};

type StreamCallbacks = {
  readonly onChunk: (text: string) => void;
  readonly onDone: () => void;
  readonly onError: (error: string) => void;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token ?? "";
  return {
    // biome-ignore lint/style/useNamingConvention: HTTP header name
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
}

export async function streamChat(
  messages: readonly ChatMessage[],
  context: ChatContext,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const headers = await getAuthHeaders();
  const url = `${getBaseUrl()}/functions/v1/ai-chat`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err.message : "Network error");
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
  let buffer = "";

  try {
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
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            callbacks.onError(parsed.error);
            return;
          }
          if (parsed.content) {
            callbacks.onChunk(parsed.content);
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
    callbacks.onDone();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err.message : "Stream error");
  }
}

export async function extractMemories(
  messages: readonly ChatMessage[]
): Promise<readonly ExtractedMemory[]> {
  try {
    const { data, error } = await getSupabase().functions.invoke("ai-chat", {
      body: { mode: "extract_memories", messages },
    });

    if (error || !data?.success || !Array.isArray(data.data)) {
      return [];
    }
    return data.data;
  } catch {
    return [];
  }
}
