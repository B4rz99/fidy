// biome-ignore-all lint/style/useNamingConvention: OAuth/API response fixtures use snake_case keys
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  EmailProviderConfig,
  FetchEmailsFn,
} from "@/features/email-capture/services/email-adapter";
import { createAdapter, getAdapter } from "@/features/email-capture/services/email-adapter";

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
        url: "fidy://test/callback?code=auth-code",
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
    });

    it("returns cancelled when user dismisses browser", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "cancelled" });
    });

    it("returns no_code when callback URL has no code", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?error=access_denied",
      });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "no_code" });
    });

    it("returns token_exchange_failed when token POST fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code",
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const adapter = createAdapter(testConfig, stubFetch);
      const result = await adapter.connect("client-id");
      expect(result).toEqual({ success: false, error: "token_exchange_failed" });
    });

    it("returns profile_fetch_failed when profile GET fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code",
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
        url: "fidy://test/callback?code=auth-code",
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

    it("stores tokens in SecureStore with correct keys", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://test/callback?code=auth-code",
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
        url: "fidy://test/callback?code=auth-code",
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
        url: "fidy://test/callback?code=auth-code",
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

  it("outlook adapter uses email-outlook-token SecureStore key", async () => {
    mockGetItemAsync.mockResolvedValueOnce("token");
    const adapter = getAdapter("outlook");
    await adapter.isConnected();
    expect(mockGetItemAsync).toHaveBeenCalledWith("email-outlook-token");
  });
});
