import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchOutlookEmailsWithToken } from "@/features/email-capture/services/outlook-adapter";

const { mockCaptureWarning } = vi.hoisted(() => ({
  mockCaptureWarning: vi.fn(),
}));

vi.mock("@/shared/lib", () => ({
  captureWarning: (...args: unknown[]) => mockCaptureWarning(...args),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("outlook adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchOutlookEmailsWithToken", () => {
    it("fetches and maps emails to RawEmail format", async () => {
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

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        externalId: "msg-1",
        from: "bank@example.com",
        subject: "Transaction Alert",
        provider: "outlook",
      });

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(decodeURIComponent(calledUrl)).toContain("receivedDateTime ge 2026-03-01T00:00:00Z");
      expect(decodeURIComponent(calledUrl)).not.toContain(
        "receivedDateTime ge '2026-03-01T00:00:00Z'"
      );
      expect(mockFetch.mock.calls[0]?.[1]).toEqual({
        headers: { Authorization: "Bearer access-token" },
      });
    });

    it("normalizes HTML email bodies to plain text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: "msg-html",
                subject: "Transaction Alert",
                from: { emailAddress: { address: "bank@example.com" } },
                body: {
                  content:
                    "<html><body><p>Método de pago</p><p>RappiCard Crédito&nbsp;**** 0746</p></body></html>",
                },
                receivedDateTime: "2026-03-05T10:00:00Z",
              },
            ],
          }),
      });

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("Método de pago RappiCard Crédito **** 0746");
    });

    it("returns empty array when no messages found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      });

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);
      expect(emails).toEqual([]);
    });

    it("returns empty array when response omits value", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toEqual([]);
    });

    it("returns empty array when API call fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);
      expect(emails).toEqual([]);
      expect(mockCaptureWarning).toHaveBeenCalledWith("outlook_api_list_failed", {
        httpStatus: 500,
      });
    });

    it("follows paginated message lists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: "msg-1",
                subject: "First",
                from: { emailAddress: { address: "bank@example.com" } },
                body: { content: "First body" },
                receivedDateTime: "2026-03-05T10:00:00Z",
              },
            ],
            "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?page=2",
          }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: "msg-2",
                subject: "Second",
                from: { emailAddress: { address: "bank@example.com" } },
                body: { content: "Second body" },
                receivedDateTime: "2026-03-06T10:00:00Z",
              },
            ],
          }),
      });

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails.map((email) => email.subject)).toEqual(["First", "Second"]);
      expect(mockFetch.mock.calls[1]?.[0]).toBe(
        "https://graph.microsoft.com/v1.0/me/messages?page=2"
      );
    });
  });
});
