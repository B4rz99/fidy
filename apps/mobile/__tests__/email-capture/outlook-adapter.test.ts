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
  connectOutlook,
  disconnectOutlook,
  fetchOutlookEmails,
  isOutlookConnected,
} from "@/features/email-capture/services/outlook-adapter";

describe("outlook adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isOutlookConnected", () => {
    it("returns true when token exists", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");
      expect(await isOutlookConnected()).toBe(true);
      expect(mockGetItemAsync).toHaveBeenCalledWith("email-outlook-token");
    });

    it("returns false when no token", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);
      expect(await isOutlookConnected()).toBe(false);
    });
  });

  describe("connectOutlook", () => {
    it("returns email on successful OAuth flow", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://email/callback?code=auth-code",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "outlook-access",
            refresh_token: "outlook-refresh",
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ mail: "user@outlook.com" }),
      });

      const result = await connectOutlook("test-client-id");
      expect(result).toEqual({ success: true, email: "user@outlook.com" });
      expect(mockSetItemAsync).toHaveBeenCalledWith("email-outlook-token", "outlook-access");
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        "email-outlook-refresh-token",
        "outlook-refresh"
      );
    });

    it("returns error when user dismisses browser", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({ type: "dismiss" });

      const result = await connectOutlook("test-client-id");
      expect(result).toEqual({ success: false, error: "cancelled" });
    });

    it("returns error when token exchange fails", async () => {
      mockOpenAuthSession.mockResolvedValueOnce({
        type: "success",
        url: "fidy://email/callback?code=auth-code",
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      const result = await connectOutlook("test-client-id");
      expect(result).toEqual({ success: false, error: "token_exchange_failed" });
    });
  });

  describe("disconnectOutlook", () => {
    it("deletes tokens from secure store", async () => {
      await disconnectOutlook();
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-outlook-token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("email-outlook-refresh-token");
    });
  });

  describe("fetchOutlookEmails", () => {
    it("fetches and maps emails to RawEmail format", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: "msg-1",
                subject: "Transaction Alert",
                from: { emailAddress: { address: "bank@example.com" } },
                body: { content: "Your purchase of $50,000" },
                receivedDateTime: "2026-03-05T10:00:00Z",
              },
            ],
          }),
      });

      const emails = await fetchOutlookEmails("2026-03-01T00:00:00Z", ["bank@example.com"]);

      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        externalId: "msg-1",
        from: "bank@example.com",
        subject: "Transaction Alert",
        provider: "outlook",
      });
    });

    it("returns empty array when no messages found", async () => {
      mockGetItemAsync.mockResolvedValueOnce("access-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });

      const emails = await fetchOutlookEmails("2026-03-01T00:00:00Z", ["bank@example.com"]);
      expect(emails).toEqual([]);
    });

    it("returns empty array when not connected", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);

      const emails = await fetchOutlookEmails("2026-03-01T00:00:00Z", ["bank@example.com"]);
      expect(emails).toEqual([]);
    });
  });
});
