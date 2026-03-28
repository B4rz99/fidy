import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGmailEmailsWithToken } from "@/features/email-capture/services/gmail-adapter";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("gmail adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchGmailEmailsWithToken", () => {
    it("fetches and maps emails to RawEmail format", async () => {
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

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
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

    it("decodes UTF-8 body correctly", async () => {
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

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe(utf8Text);
    });

    it("handles invalid date header gracefully", async () => {
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

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toHaveLength(1);
      expect(emails[0]?.receivedAt).toBeDefined();
      expect(() => new Date(emails[0]!.receivedAt)).not.toThrow();
    });

    it("returns empty array when no messages found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);
      expect(emails).toEqual([]);
    });
  });
});
