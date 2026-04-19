// biome-ignore-all lint/style/useNamingConvention: test fixtures mirror HTTP headers and Supabase payloads
import { describe, expect, it, vi } from "vitest";

vi.mock("expo/fetch", () => ({
  fetch: globalThis.fetch,
}));

import { createAiChatApiService } from "@/features/ai-chat/services/create-ai-chat-api-service";

describe("createAiChatApiService", () => {
  it("streams chunks with auth headers from Supabase session", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('data: {"content":"Hello"}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn(),
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk,
      onDone,
      onError,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/ai-chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(onChunk).toHaveBeenCalledWith("Hello");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("captures chunk callback failures without crashing the stream", async () => {
    const captureError = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('data: {"content":"Hello"}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError,
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    const onDone = vi.fn();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk: () => {
        throw new Error("callback boom");
      },
      onDone,
      onError: vi.fn(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureError).toHaveBeenCalledWith(expect.any(Error));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("reports non-OK responses as stream errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn(),
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    const onError = vi.fn();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith("HTTP 503");
  });

  it("reports auth header resolution failures through onError", async () => {
    const fetchImpl = vi.fn();

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi.fn().mockRejectedValue(new Error("session offline")),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn(),
        captureWarning: vi.fn(),
        capturePipelineEvent: vi.fn(),
      },
    });

    const onError = vi.fn();

    await expect(
      service.streamChat([{ role: "user", content: "hello" }], {
        onChunk: vi.fn(),
        onDone: vi.fn(),
        onError,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("session offline");
  });
});
