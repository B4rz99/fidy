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

      const result = await connectGmail("test-client-id");
      expect(result).toEqual({ success: true, email: "user@gmail.com" });
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-gmail-token", "gmail-access");
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-gmail-refresh-token", "gmail-refresh");
    });

    it("returns error when user dismisses browser", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" });

      const result = await connectGmail("test-client-id");
      expect(result).toEqual({ success: false, error: "cancelled" });
    });

    it("returns error when token exchange fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://email/callback?code=auth-code",
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const result = await connectGmail("test-client-id");
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
      mockGetItemAsync.mockResolvedValueOnce("access-token");

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

      const emails = await fetchGmailEmails("2026-03-01T00:00:00Z", ["bank@example.com"]);

      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        externalId: "msg-1",
        from: "bank@example.com",
        subject: "Transaction Alert",
        provider: "gmail",
      });
    });

    it("returns empty array when no messages found", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const emails = await fetchGmailEmails("2026-03-01T00:00:00Z", ["bank@example.com"]);
      expect(emails).toEqual([]);
    });

    it("returns empty array when not connected", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);

      const emails = await fetchGmailEmails("2026-03-01T00:00:00Z", ["bank@example.com"]);
      expect(emails).toEqual([]);
    });
  });
});
