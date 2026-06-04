// biome-ignore-all lint/style/useNamingConvention: test fixtures mirror HTTP headers and Supabase payloads
import { describe, expect, it, vi } from "vitest";
import { createAiChatApiService } from "@/features/ai-chat/services/create-ai-chat-api-service";
import { requireMonth } from "@/shared/types/assertions";

vi.mock("expo/fetch", () => ({
  fetch: globalThis.fetch,
}));

describe("createAiChatApiService", () => {
  it("streams chunks with auth headers from Supabase session", async () => {
    const fetchImpl = vi.fn<(...args: any[]) => any>().mockResolvedValue(
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
              getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    const onChunk = vi.fn<(...args: any[]) => any>();
    const onDone = vi.fn<(...args: any[]) => any>();
    const onError = vi.fn<(...args: any[]) => any>();

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

  it("flushes a final SSE chunk when the stream closes without a trailing newline", async () => {
    const encoder = new TextEncoder();
    const payload = encoder.encode('data: {"content":"Caf\u00e9"}');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload.slice(0, -1));
        controller.enqueue(payload.slice(-1));
        controller.close();
      },
    });
    const fetchImpl = vi.fn<(...args: any[]) => any>().mockResolvedValue(
      new Response(stream, {
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
              getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    const onChunk = vi.fn<(...args: any[]) => any>();
    const onDone = vi.fn<(...args: any[]) => any>();
    const onError = vi.fn<(...args: any[]) => any>();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk,
      onDone,
      onError,
    });

    expect(onChunk).toHaveBeenCalledWith("Caf\u00e9");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("sends an app-built financial context packet with chat messages", async () => {
    const fetchImpl = vi.fn<(...args: any[]) => any>().mockResolvedValue(
      new Response("data: [DONE]\n\n", {
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
              getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    await service.streamChat(
      [{ role: "user", content: "how am I doing?" }],
      {
        onChunk: vi.fn<(...args: any[]) => any>(),
        onDone: vi.fn<(...args: any[]) => any>(),
        onError: vi.fn<(...args: any[]) => any>(),
      },
      {
        financialContextPacket: {
          summary: {
            balance: 125000,
            currentMonthSpending: [{ categoryId: "food", total: 50000 }],
            previousMonthSpending: [],
            monthOverMonthDeltas: [
              { categoryId: "food", current: 50000, previous: 0, delta: 50000 },
            ],
          },
          recentTransactions: [
            {
              type: "expense",
              amount: 50000,
              categoryId: "food",
              description: "Lunch",
              date: "2026-04-20",
            },
          ],
          budgets: [{ categoryId: "food", amount: 200000, month: requireMonth("2026-04") }],
          goals: [],
          accounts: [],
          captureEvidence: [],
        },
      }
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      messages: [{ role: "user", content: "how am I doing?" }],
      financialContextPacket: {
        summary: {
          balance: 125000,
        },
        recentTransactions: [
          {
            description: "Lunch",
          },
        ],
      },
    });
  });

  it("captures chunk callback failures without crashing the stream", async () => {
    const captureError = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
    const fetchImpl = vi.fn<(...args: any[]) => any>().mockResolvedValue(
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
              getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError,
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    const onDone = vi.fn<(...args: any[]) => any>();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk: () => {
        throw new Error("callback boom");
      },
      onDone,
      onError: vi.fn<(...args: any[]) => any>(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureError).toHaveBeenCalledWith(expect.any(Error));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("reports non-OK responses as stream errors", async () => {
    const fetchImpl = vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue(new Response("nope", { status: 503 }));

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    const onError = vi.fn<(...args: any[]) => any>();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith("HTTP 503");
  });

  it("reports network failures when posting chat messages", async () => {
    const fetchImpl = vi.fn<(...args: any[]) => any>().mockRejectedValue(new Error("offline"));

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi.fn<(...args: any[]) => any>().mockResolvedValue({
                data: { session: { access_token: "token-123" } },
              }),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    const onError = vi.fn<(...args: any[]) => any>();

    await service.streamChat([{ role: "user", content: "hello" }], {
      onChunk: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith("offline");
  });

  it("reports auth header resolution failures through onError", async () => {
    const fetchImpl = vi.fn<(...args: any[]) => any>();

    const service = createAiChatApiService({
      fetchImpl: fetchImpl as never,
      getBaseUrl: () => "https://example.supabase.co",
      supabase: {
        getSupabase: () =>
          ({
            auth: {
              getSession: vi
                .fn<(...args: any[]) => any>()
                .mockRejectedValue(new Error("session offline")),
            },
          }) as never,
      },
      telemetry: {
        captureError: vi.fn<(...args: any[]) => any>(),
        captureWarning: vi.fn<(...args: any[]) => any>(),
        capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
      },
    });

    const onError = vi.fn<(...args: any[]) => any>();

    await expect(
      service.streamChat([{ role: "user", content: "hello" }], {
        onChunk: vi.fn<(...args: any[]) => any>(),
        onDone: vi.fn<(...args: any[]) => any>(),
        onError,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("session offline");
  });
});
