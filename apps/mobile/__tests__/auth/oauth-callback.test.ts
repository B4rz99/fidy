import { describe, expect, it } from "vitest";
import { readSupabaseSessionTokens } from "@/features/auth/oauth-callback";

describe("readSupabaseSessionTokens", () => {
  const redirectUri = "fidy://auth/callback";

  it("reads Supabase tokens from a matching callback URL hash", () => {
    expect(
      readSupabaseSessionTokens(
        "fidy://auth/callback#access_token=access&refresh_token=refresh",
        redirectUri
      )
    ).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  it("returns null for invalid URLs, redirect mismatches, and missing tokens", () => {
    expect(readSupabaseSessionTokens("not a url", redirectUri)).toBeNull();
    expect(
      readSupabaseSessionTokens("fidy://other/callback#access_token=a&refresh_token=r", redirectUri)
    ).toBeNull();
    expect(
      readSupabaseSessionTokens("fidy://auth/callback#refresh_token=r", redirectUri)
    ).toBeNull();
    expect(
      readSupabaseSessionTokens("fidy://auth/callback#access_token=a", redirectUri)
    ).toBeNull();
    expect(
      readSupabaseSessionTokens("fidy://auth/callback#access_token=&refresh_token=r", redirectUri)
    ).toBeNull();
  });
});
