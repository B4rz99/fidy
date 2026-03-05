import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  connectGmail,
  disconnectGmail,
  fetchGmailEmails,
  isGmailConnected,
} from "@/features/email-capture/services/gmail-adapter";

const CLIENT_ID = "test-client-id";

describe("gmail adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isGmailConnected", () => {
    it("returns true when token exists", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      expect(await isGmailConnected()).toBe(true);
      expect(mockGetItemAsync).toHaveBeenCalledWith("email-gmail-token");
    });

    it("returns false when no token", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);
      expect(await isGmailConnected()).toBe(false);
    });
  });

  describe("connectGmail", () => {
    it("returns email on successful OAuth flow", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://email/callback?code=auth-code",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "gmail-access",
            refresh_token: "gmail-refresh",
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ emailAddress: "user@gmail.com" }),
      });

      const result = await connectGmail(CLIENT_ID);
      expect(result).toEqual({ success: true, email: "user@gmail.com" });
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-gmail-token", "gmail-access");
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-gmail-refresh-token", "gmail-refresh");
    });

    it("returns error when user dismisses browser", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" });

      const result = await connectGmail(CLIENT_ID);
      expect(result).toEqual({ success: false, error: "cancelled" });
    });

    it("returns error when token exchange fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://email/callback?code=auth-code",
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const result = await connectGmail(CLIENT_ID);
      expect(result).toEqual({ success: false, error: "token_exchange_failed" });
    });
  });

  describe("disconnectGmail", () => {
    it("deletes tokens from secure store", async () => {
      await disconnectGmail();
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-gmail-token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-gmail-refresh-token");
    });
  });

  describe("fetchGmailEmails", () => {
    it("fetches and maps emails to RawEmail format", async () => {
      // getValidToken: getItemAsync returns token, profile check succeeds
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-1" }] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-1",
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Transaction Alert" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "SGVsbG8gV29ybGQ" } }],
            },
          }),
      });

      const emails = await fetchGmailEmails(CLIENT_ID, "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        externalId: "msg-1",
        from: "bank@example.com",
        subject: "Transaction Alert",
        provider: "gmail",
      });
    });

    it("refreshes expired token and persists rotated refresh token", async () => {
      // getValidToken: token exists but profile check fails (expired)
      mockGetItemAsync.mockResolvedValueOnce("expired-token");
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      // refresh token exists
      mockGetItemAsync.mockResolvedValueOnce("refresh-token");
      // refresh succeeds with rotated refresh token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "new-token", refresh_token: "new-refresh" }),
      });

      // list messages
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-1" }] }),
      });

      // get message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-1",
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Alerta" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "dGVzdA" } }],
            },
          }),
      });

      const emails = await fetchGmailEmails(CLIENT_ID, "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toHaveLength(1);
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-gmail-token", "new-token");
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-gmail-refresh-token", "new-refresh");
    });

    it("decodes UTF-8 body correctly", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      // "Compra aprobada por $50.000 en ÉXITO" in base64url
      const utf8Text = "Compra aprobada por $50.000 en ÉXITO";
      const encoded = Buffer.from(utf8Text, "utf-8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-utf8" }] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-utf8",
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Compra" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: encoded } }],
            },
          }),
      });

      const emails = await fetchGmailEmails(CLIENT_ID, "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0].body).toBe(utf8Text);
    });

    it("handles invalid date header gracefully", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-bad-date" }] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-bad-date",
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Alert" },
                { name: "Date", value: "not-a-date" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "dGVzdA" } }],
            },
          }),
      });

      const emails = await fetchGmailEmails(CLIENT_ID, "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toHaveLength(1);
      expect(emails[0].receivedAt).toBeDefined();
      expect(() => new Date(emails[0].receivedAt)).not.toThrow();
    });

    it("returns empty array when no messages found", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const emails = await fetchGmailEmails(CLIENT_ID, "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);
      expect(emails).toEqual([]);
    });

    it("returns empty array when not connected", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);

      const emails = await fetchGmailEmails(CLIENT_ID, "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);
      expect(emails).toEqual([]);
    });
  });
});
