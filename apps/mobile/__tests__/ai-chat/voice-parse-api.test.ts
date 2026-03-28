import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock expo/fetch before importing the module under test
vi.mock("expo/fetch", () => ({
  fetch: vi.fn(),
}));

// Mock shared/db to control getSupabase
vi.mock("@/shared/db", () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          // biome-ignore lint/style/useNamingConvention: Supabase API field name
          data: { session: { access_token: "test-token" } },
          error: null,
        })
      ),
    },
  })),
}));

// Mock captureError so it doesn't blow up
vi.mock("@/shared/lib", () => ({
  captureError: vi.fn(),
}));

import { fetch as expoFetch } from "expo/fetch";
import { voiceParse } from "../../features/ai-chat/services/ai-chat-api";

const mockFetch = expoFetch as ReturnType<typeof vi.fn>;

const VALID_RESULT = {
  type: "expense" as const,
  amount: 50000,
  categoryId: "food",
  description: "Almuerzo en restaurante",
  date: "2026-03-27",
};

beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
});

describe("voiceParse", () => {
  it("returns VoiceParseResult on successful response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: VALID_RESULT }),
    });

    const result = await voiceParse("Gasté 50 mil en almuerzo", "es-CO");

    expect(result).toEqual(VALID_RESULT);
  });

  it("sends correct body with mode, transcript, and locale", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: VALID_RESULT }),
    });

    await voiceParse("I spent 10 dollars on coffee", "en-US");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/functions/v1/ai-chat");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({
      mode: "voice_parse",
      transcript: "I spent 10 dollars on coffee",
      locale: "en-US",
    });
  });

  it("sends Authorization header with bearer token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: VALID_RESULT }),
    });

    await voiceParse("test", "en-US");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers).toMatchObject({
      // biome-ignore lint/style/useNamingConvention: HTTP header name
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
  });

  it("returns null when HTTP response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await voiceParse("some transcript", "en-US");

    expect(result).toBeNull();
  });

  it("returns null when API returns success: false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: "parse_failed" }),
    });

    const result = await voiceParse("mumbled text", "en-US");

    expect(result).toBeNull();
  });

  it("returns null when API returns no data field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await voiceParse("test", "en-US");

    expect(result).toBeNull();
  });

  it("returns null and captures error on network error", async () => {
    const { captureError } = await import("@/shared/lib");
    mockFetch.mockRejectedValueOnce(new Error("Network request failed"));

    const result = await voiceParse("test", "en-US");

    expect(result).toBeNull();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error));
  });
});
