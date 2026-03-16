import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { fetchOutlookEmailsWithToken } from "@/features/email-capture/services/outlook-adapter";

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

    it("returns empty array when API call fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const emails = await fetchOutlookEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);
      expect(emails).toEqual([]);
    });
  });
});
