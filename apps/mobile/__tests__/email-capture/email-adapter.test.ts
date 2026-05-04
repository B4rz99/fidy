// biome-ignore-all lint/style/useNamingConvention: OAuth/API response fixtures use snake_case keys
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EmailProviderConfig,
  FetchEmailsFn,
} from "@/features/email-capture/services/email-adapter";
import { createAdapter, getAdapter } from "@/features/email-capture/services/email-adapter";

const { mockCaptureError, mockCaptureWarning } = vi.hoisted(() => ({
  mockCaptureError: vi.fn(),
  mockCaptureWarning: vi.fn(),
}));

const mockGetItemAsync = vi.fn();
const mockSetItemAsync = vi.fn();
const mockDeleteItemAsync = vi.fn();

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

const mockOpenAuthSession = vi.fn();

vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSession(...args),
}));

vi.mock("expo-crypto", () => ({
  getRandomBytes: (size: number) => new Uint8Array(size),
  digest: async () => new ArrayBuffer(32),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

vi.mock("@/shared/lib", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  captureWarning: (...args: unknown[]) => mockCaptureWarning(...args),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const testConfig: EmailProviderConfig = {
  provider: "gmail",
  tokenKey: "test-token",
  refreshTokenKey: "test-refresh-token",
  authUrl: "https://auth.example.com",
  tokenUrl: "https://token.example.com",
  scope: "read",
  getRedirectUri: () => "fidy://test/callback",
  profileUrl: "https://profile.example.com/me",
  extractEmail: (profile) => (typeof profile.email === "string" ? profile.email : null),
  extraAuthParams: {},
  extraTokenExchangeParams: {},
  extraRefreshParams: {},
};

const stubFetch: FetchEmailsFn = vi.fn().mockResolvedValue([]);

describe("createAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isConnected", () => {
    it("returns true when SecureStore has token", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      const adapter = createAdapter(testConfig, stubFetch);
      expect(await adapter.isConnected()).toBe(true);
      expect(mockGetItemAsync).toHaveBeenCalledWith("test-token");
    });

    it("returns false when no token", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);
      const adapter = createAdapter(testConfig, stubFetch);
      expect(await adapter.isConnected()).toBe(false);
    });

    it("returns false on SecureStore error", async () => {
      mockGetItemAsync.mockRejectedValueOnce(new Error("keychain error"));
      const adapter = createAdapter(testConfig, stubFetch);
      expect(await adapter.isConnected()).toBe(false);
    });
  });

  describe("disconnect", () => {
    it("deletes correct token keys", async () => {
      const adapter = createAdapter(testConfig, stubFetch);
      await adapter.disconnect();
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("test-token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("test-refresh-token");
    });
  });

  describe("connect", () => {
    it("returns email on successful OAuth flow", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "at", refresh_token: "rt" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "user@test.com" }),
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: true, email: "user@test.com" });

      const authUrl = new URL(mockOpenAuthSession.mock.calls[0]?.[0] as string);
      expect(authUrl.origin + authUrl.pathname).toBe("https://auth.example.com/");
      expect(authUrl.searchParams.get("client_id")).toBe("client-id");
      expect(authUrl.searchParams.get("redirect_uri")).toBe("fidy://test/callback");
      expect(authUrl.searchParams.get("response_type")).toBe("code");
      expect(authUrl.searchParams.get("scope")).toBe("read");
      expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");

      const tokenRequest = mockFetch.mock.calls[0];
      expect(tokenRequest?.[0]).toBe("https://token.example.com");
      expect(tokenRequest?.[1]).toMatchObject({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      expect(new URLSearchParams(tokenRequest?.[1]?.body as string).get("grant_type")).toBe(
        "authorization_code"
      );

      expect(mockFetch.mock.calls[1]).toEqual([
        "https://profile.example.com/me",
        { headers: { Authorization: "Bearer at" } },
      ]);
    });

    it("returns cancelled when user dismisses browser", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "cancelled" });
      expect(result.success).toBe(false);
    });

    it("returns cancelled when browser returns a non-success result with a URL", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "cancel",
        url: "fidy://test/callback?code=auth-code",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");

      expect(result).toEqual({ success: false, error: "cancelled" });
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns cancelled when browser success has no callback URL", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({ type: "success" });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");

      expect(result).toEqual({ success: false, error: "cancelled" });
      expect(result.success).toBe(false);
    });

    it("returns cancelled when OAuth flow throws", async () => {
      mockOpenAuthSession.mockRejectedValueOnce(new Error("browser unavailable"));

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");

      expect(result).toEqual({ success: false, error: "cancelled" });
      expect(mockCaptureError).toHaveBeenCalledOnce();
    });

    it("returns no_code when callback URL has no code", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?error=access_denied&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "no_code" });
    });

    it("returns no_code when callback URL has an empty code", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "no_code" });
    });

    it("rejects callback URLs that do not match the configured redirect URI", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://other/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");

      expect(result).toEqual({ success: false, error: "invalid_callback" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects callback URLs on a different port", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test:123/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");

      expect(result).toEqual({ success: false, error: "invalid_callback" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects callback URLs with a missing or mismatched state", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=attacker-state",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");

      expect(result).toEqual({ success: false, error: "invalid_callback" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns token_exchange_failed when token POST fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "token_exchange_failed" });
    });

    it("returns profile_fetch_failed when profile GET fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "at", refresh_token: "rt" }),
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "profile_fetch_failed" });
    });

    it("returns no_email_found when extractEmail returns null", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "at" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ noEmailField: true }),
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "no_email_found" });
    });

    it("returns no_email_found when extractEmail returns an empty string", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "at" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "" }),
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "no_email_found" });
    });

    it("stores tokens in SecureStore with correct keys", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "my-access", refresh_token: "my-refresh" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "user@test.com" }),
      });

      const adapter = createAdapter(testConfig, stubFetch);
      await adapter.connect("client-id");

      expect(mockSetItemAsync).toHaveBeenCalledWith("test-token", "my-access");
      expect(mockSetItemAsync).toHaveBeenCalledWith("test-refresh-token", "my-refresh");
    });

    it("stores refresh_token only when present", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "my-access" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "user@test.com" }),
      });

      const adapter = createAdapter(testConfig, stubFetch);
      await adapter.connect("client-id");

      expect(mockSetItemAsync).toHaveBeenCalledWith("test-token", "my-access");
      expect(mockSetItemAsync).not.toHaveBeenCalledWith("test-refresh-token", expect.anything());
      expect(mockSetItemAsync).toHaveBeenCalledTimes(1);
    });

    it("merges extraAuthParams into OAuth URL", async () => {
      const configWithExtra: EmailProviderConfig = {
        ...testConfig,
        extraAuthParams: { access_type: "offline", prompt: "consent" },
      };

      mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" });

      const adapter = createAdapter(configWithExtra, stubFetch);
      await adapter.connect("client-id");

      const calledUrl = mockOpenAuthSession.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("access_type=offline");
      expect(calledUrl).toContain("prompt=consent");
    });

    it("merges extraTokenExchangeParams into token request", async () => {
      const configWithExtra: EmailProviderConfig = {
        ...testConfig,
        extraTokenExchangeParams: { scope: "read write" },
      };

      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const adapter = createAdapter(configWithExtra, stubFetch);
      await adapter.connect("client-id");

      const body = mockFetch.mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("scope=read+write");
    });
  });

  describe("fetchEmails", () => {
    it("returns [] when no token in SecureStore", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);
      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);
      expect(result).toEqual([]);
      expect(stubFetch).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("delegates to fetchFn when token is valid", async () => {
      // getValidToken: token exists, profile check succeeds
      mockGetItemAsync.mockResolvedValueOnce("valid-token");
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      const mockEmails = [
        {
          externalId: "1",
          from: "a@b.com",
          subject: "X",
          body: "Y",
          receivedAt: "2026-03-01",
          provider: "gmail" as const,
        },
      ];
      const fetchFn = vi.fn().mockResolvedValue(mockEmails);
      const adapter = createAdapter(testConfig, fetchFn);
      const result = await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      expect(fetchFn).toHaveBeenCalledWith("valid-token", "2026-03-01", ["a@b.com"]);
      expect(result).toEqual(mockEmails);
    });

    it("refreshes expired token and delegates with new token", async () => {
      // token exists but profile check fails
      mockGetItemAsync.mockResolvedValueOnce("expired-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      // refresh token exists
      mockGetItemAsync.mockResolvedValueOnce("refresh-token");
      // refresh succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "new-token" }),
      });

      const fetchFn = vi.fn().mockResolvedValue([]);
      const adapter = createAdapter(testConfig, fetchFn);
      await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      expect(mockSetItemAsync).toHaveBeenCalledWith("test-token", "new-token");
      expect(fetchFn).toHaveBeenCalledWith("new-token", "2026-03-01", ["a@b.com"]);

      const validationRequest = mockFetch.mock.calls[0];
      expect(validationRequest).toEqual([
        "https://profile.example.com/me",
        { headers: { Authorization: "Bearer expired-token" } },
      ]);
      const refreshRequest = mockFetch.mock.calls[1];
      expect(refreshRequest?.[0]).toBe("https://token.example.com");
      expect(refreshRequest?.[1]).toMatchObject({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      expect(new URLSearchParams(refreshRequest?.[1]?.body as string).get("grant_type")).toBe(
        "refresh_token"
      );
    });

    it("persists rotated refresh token during refresh", async () => {
      mockGetItemAsync.mockResolvedValueOnce("expired-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      mockGetItemAsync.mockResolvedValueOnce("old-refresh");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "new-token", refresh_token: "new-refresh" }),
      });

      const fetchFn = vi.fn().mockResolvedValue([]);
      const adapter = createAdapter(testConfig, fetchFn);
      await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      expect(mockSetItemAsync).toHaveBeenCalledWith("test-refresh-token", "new-refresh");
    });

    it("returns [] when refresh fails", async () => {
      mockGetItemAsync.mockResolvedValueOnce("expired-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      mockGetItemAsync.mockResolvedValueOnce("refresh-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const fetchFn = vi.fn().mockResolvedValue([]);
      const adapter = createAdapter(testConfig, fetchFn);
      const result = await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      expect(result).toEqual([]);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockCaptureWarning).toHaveBeenCalledWith("email_token_refresh_failed", {
        provider: "gmail",
        httpStatus: 400,
      });
    });

    it("returns [] when token is expired and no refresh token exists", async () => {
      mockGetItemAsync.mockResolvedValueOnce("expired-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      mockGetItemAsync.mockResolvedValueOnce(null);

      const fetchFn = vi.fn().mockResolvedValue([]);
      const adapter = createAdapter(testConfig, fetchFn);
      const result = await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      expect(result).toEqual([]);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns [] when token validation throws", async () => {
      mockGetItemAsync.mockResolvedValueOnce("stored-token");
      mockFetch.mockRejectedValueOnce(new Error("profile unavailable"));

      const fetchFn = vi.fn().mockResolvedValue([]);
      const adapter = createAdapter(testConfig, fetchFn);
      const result = await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      expect(result).toEqual([]);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockCaptureError).toHaveBeenCalledOnce();
    });

    it("merges extraRefreshParams into refresh request", async () => {
      const configWithRefresh: EmailProviderConfig = {
        ...testConfig,
        extraRefreshParams: { scope: "read User.Read" },
      };

      mockGetItemAsync.mockResolvedValueOnce("expired-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      mockGetItemAsync.mockResolvedValueOnce("refresh-token");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "new-token" }),
      });

      const fetchFn = vi.fn().mockResolvedValue([]);
      const adapter = createAdapter(configWithRefresh, fetchFn);
      await adapter.fetchEmails("client-id", "2026-03-01", ["a@b.com"]);

      const refreshBody = mockFetch.mock.calls[1]?.[1]?.body as string;
      expect(refreshBody).toContain("scope=read+User.Read");
    });
  });
});

describe("getAdapter", () => {
  it("returns a gmail adapter with isConnected callable", async () => {
    const adapter = getAdapter("gmail");
    expect(adapter.isConnected).toBeTypeOf("function");
  });

  it("returns an outlook adapter with isConnected callable", async () => {
    const adapter = getAdapter("outlook");
    expect(adapter.isConnected).toBeTypeOf("function");
  });

  it("gmail adapter uses email-gmail-token SecureStore key", async () => {
    mockGetItemAsync.mockResolvedValueOnce("token");
    const adapter = getAdapter("gmail");
    await adapter.isConnected();
    expect(mockGetItemAsync).toHaveBeenCalledWith("email-gmail-token");
  });

  it("gmail adapter deletes both provider token keys on disconnect", async () => {
    const adapter = getAdapter("gmail");
    await adapter.disconnect();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-gmail-token");
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-gmail-refresh-token");
  });

  it("gmail adapter reports refresh failures with provider name", async () => {
    const adapter = getAdapter("gmail");
    mockGetItemAsync.mockResolvedValueOnce("expired-gmail-token");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockGetItemAsync.mockResolvedValueOnce("gmail-refresh-token");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(adapter.fetchEmails("gmail-client", "2026-03-01", [])).resolves.toEqual([]);

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_token_refresh_failed", {
      provider: "gmail",
      httpStatus: 403,
    });
  });

  it("outlook adapter uses email-outlook-token SecureStore key", async () => {
    mockGetItemAsync.mockResolvedValueOnce("token");
    const adapter = getAdapter("outlook");
    await adapter.isConnected();
    expect(mockGetItemAsync).toHaveBeenCalledWith("email-outlook-token");
  });

  it("outlook adapter deletes both provider token keys on disconnect", async () => {
    const adapter = getAdapter("outlook");
    await adapter.disconnect();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-outlook-token");
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-outlook-refresh-token");
  });

  it("outlook adapter reports refresh failures with provider name", async () => {
    const adapter = getAdapter("outlook");
    mockGetItemAsync.mockResolvedValueOnce("expired-outlook-token");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockGetItemAsync.mockResolvedValueOnce("outlook-refresh-token");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(adapter.fetchEmails("outlook-client", "2026-03-01", [])).resolves.toEqual([]);

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_token_refresh_failed", {
      provider: "outlook",
      httpStatus: 403,
    });
  });

  it("gmail adapter extracts profile emailAddress during connect", async () => {
    const adapter = getAdapter("gmail");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "gmail-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ emailAddress: "gmail-user@example.com" }),
    });

    await expect(adapter.connect("gmail-client")).resolves.toEqual({
      success: true,
      email: "gmail-user@example.com",
    });

    const authUrl = new URL(mockOpenAuthSession.mock.calls[0]?.[0] as string);
    expect(authUrl.origin + authUrl.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(authUrl.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/gmail.readonly"
    );
    expect(authUrl.searchParams.get("access_type")).toBe("offline");
    expect(authUrl.searchParams.get("prompt")).toBe("consent");
    expect(mockFetch.mock.calls[0]?.[0]).toBe("https://oauth2.googleapis.com/token");
    expect(mockFetch.mock.calls[1]?.[0]).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile"
    );
  });

  it("gmail adapter rejects profiles without emailAddress", async () => {
    const adapter = getAdapter("gmail");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "gmail-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ emailAddress: null }),
    });

    await expect(adapter.connect("gmail-client")).resolves.toEqual({
      success: false,
      error: "no_email_found",
    });
  });

  it("gmail adapter rejects non-string profile emailAddress", async () => {
    const adapter = getAdapter("gmail");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "gmail-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ emailAddress: 123 }),
    });

    await expect(adapter.connect("gmail-client")).resolves.toEqual({
      success: false,
      error: "no_email_found",
    });
  });

  it("outlook adapter extracts mail during connect", async () => {
    const adapter = getAdapter("outlook");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "outlook-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ mail: "outlook-user@example.com" }),
    });

    await expect(adapter.connect("outlook-client")).resolves.toEqual({
      success: true,
      email: "outlook-user@example.com",
    });

    const authUrl = new URL(mockOpenAuthSession.mock.calls[0]?.[0] as string);
    expect(authUrl.origin + authUrl.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    );
    expect(authUrl.searchParams.get("scope")).toBe("Mail.Read User.Read");
    expect(authUrl.searchParams.get("prompt")).toBe("consent");
    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    );
    expect(new URLSearchParams(mockFetch.mock.calls[0]?.[1]?.body as string).get("scope")).toBe(
      "Mail.Read User.Read"
    );
    expect(mockFetch.mock.calls[1]?.[0]).toBe("https://graph.microsoft.com/v1.0/me");

    mockGetItemAsync.mockResolvedValueOnce("expired-token");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockGetItemAsync.mockResolvedValueOnce("refresh-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "new-outlook-token" }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) });
    await adapter.fetchEmails("outlook-client", "2026-03-01", []);
    expect(new URLSearchParams(mockFetch.mock.calls[3]?.[1]?.body as string).get("scope")).toBe(
      "Mail.Read User.Read"
    );
  });

  it("outlook adapter falls back to userPrincipalName during connect", async () => {
    const adapter = getAdapter("outlook");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "outlook-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ mail: null, userPrincipalName: "upn@example.com" }),
    });

    await expect(adapter.connect("outlook-client")).resolves.toEqual({
      success: true,
      email: "upn@example.com",
    });
  });

  it("outlook adapter rejects profiles without mail or userPrincipalName", async () => {
    const adapter = getAdapter("outlook");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "outlook-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ mail: null, userPrincipalName: null }),
    });

    await expect(adapter.connect("outlook-client")).resolves.toEqual({
      success: false,
      error: "no_email_found",
    });
  });

  it("outlook adapter rejects non-string mail and userPrincipalName", async () => {
    const adapter = getAdapter("outlook");

    mockOpenAuthSession.mockImplementationOnce((_: string, redirectUri: string) =>
      Promise.resolve({
        type: "success",
        url: `${redirectUri}?code=auth-code&state=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      })
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: "outlook-token" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ mail: 123, userPrincipalName: 456 }),
    });

    await expect(adapter.connect("outlook-client")).resolves.toEqual({
      success: false,
      error: "no_email_found",
    });
  });
});
