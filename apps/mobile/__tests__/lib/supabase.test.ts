import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabase, resetSupabase } from "@/shared/db/supabase";

process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getSession: vi.fn() } })),
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

describe("getSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabase();
  });

  it("returns a supabase client", () => {
    const client = getSupabase();
    expect(client).toBeDefined();
    expect(client).toHaveProperty("auth");
  });

  it("returns the same instance on subsequent calls (singleton)", () => {
    const client1 = getSupabase();
    const client2 = getSupabase();
    expect(client1).toBe(client2);
  });

  it("creates client with custom storage adapter", () => {
    getSupabase();
    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: expect.any(Object),
        }),
      })
    );
  });

  it("throws when env vars are missing", () => {
    const origUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = "";
    try {
      expect(() => getSupabase()).toThrow("Missing EXPO_PUBLIC_SUPABASE_URL");
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_URL = origUrl;
    }
  });
});
