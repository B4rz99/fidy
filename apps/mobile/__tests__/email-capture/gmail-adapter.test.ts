import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGmailEmailsWithToken } from "@/features/email-capture/services/gmail-adapter";

const { mockCaptureError, mockCaptureWarning } = vi.hoisted(() => ({
  mockCaptureError: vi.fn(),
  mockCaptureWarning: vi.fn(),
}));

vi.mock("@/shared/lib", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  captureWarning: (...args: unknown[]) => mockCaptureWarning(...args),
}));

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
        receivedAt: "2026-03-05T10:00:00.000Z",
        provider: "gmail",
      });
      expect(mockFetch.mock.calls[0]).toEqual([
        expect.stringContaining("https://gmail.googleapis.com/gmail/v1/users/me/messages?"),
        { headers: { Authorization: "Bearer access-token" } },
      ]);
      const listUrl = new URL(mockFetch.mock.calls[0]?.[0] as string);
      expect(listUrl.searchParams.get("q")).toBe("(from:bank@example.com) after:1772323200");
      expect(listUrl.searchParams.has("pageToken")).toBe(false);
      expect(mockFetch.mock.calls[1]).toEqual([
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-1?format=full",
        { headers: { Authorization: "Bearer access-token" } },
      ]);
    });

    it("reads body data directly from the root payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-root" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "Banco <bank@example.com>" },
                { name: "Subject", value: "Root Body" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              body: { data: "cm9vdCBib2R5" },
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]).toMatchObject({ from: "bank@example.com", body: "root body" });
    });

    it("finds nested plain-text message parts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-nested" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Nested Body" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [
                {
                  mimeType: "multipart/alternative",
                  parts: [{ mimeType: "text/plain", body: { data: "bmVzdGVkIGJvZHk" } }],
                },
              ],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("nested body");
    });

    it("uses an empty body when payload has no body or parts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-empty-body" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Empty Body" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("");
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

    it("normalizes HTML fallback bodies with the shared email text utility", async () => {
      const htmlBody =
        "<html><body><p>Método de pago</p><p>RappiCard Crédito&nbsp;**** 0746</p></body></html>";
      const encoded = Buffer.from(htmlBody, "utf-8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-html" }] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-html",
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Compra" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/html", body: { data: encoded } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("Método de pago RappiCard Crédito **** 0746");
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
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when message list request fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toEqual([]);
      expect(mockCaptureWarning).toHaveBeenCalledWith("gmail_api_list_failed", { httpStatus: 503 });
    });

    it("skips individual messages that fail to fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-fail" }, { id: "msg-ok" }] }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Fetched" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "ZmV0Y2hlZA" } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails.map((email) => email.externalId)).toEqual(["msg-ok"]);
    });

    it("fetches message details in sequential batches of five", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            messages: ["1", "2", "3", "4", "5", "6"].map((id) => ({ id: `msg-${id}` })),
          }),
      });
      for (const id of ["1", "2", "3", "4", "5", "6"]) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              payload: {
                headers: [
                  { name: "From", value: "bank@example.com" },
                  { name: "Subject", value: `Message ${id}` },
                  { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
                ],
                parts: [{ mimeType: "text/plain", body: { data: "Ym9keQ" } }],
              },
            }),
        });
      }

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails.map((email) => email.externalId)).toEqual([
        "msg-1",
        "msg-2",
        "msg-3",
        "msg-4",
        "msg-5",
        "msg-6",
      ]);
      expect(mockFetch).toHaveBeenCalledTimes(7);
      expect(mockFetch.mock.calls.slice(1).map((call) => call[0])).toEqual([
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-1?format=full",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-2?format=full",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-3?format=full",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-4?format=full",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-5?format=full",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/msg-6?format=full",
      ]);
    });

    it("builds multi-sender list queries with OR separators", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "one@example.com",
        "two@example.com",
      ]);

      const listUrl = new URL(mockFetch.mock.calls[0]?.[0] as string);
      expect(listUrl.searchParams.get("q")).toBe(
        "(from:one@example.com OR from:two@example.com) after:1772323200"
      );
    });

    it("surfaces non-fulfilled message fetches as skipped messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-throws" }, { id: "msg-ok" }] }),
      });
      mockFetch.mockRejectedValueOnce(new Error("network down"));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Fetched" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "ZmV0Y2hlZA" } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails.map((email) => email.externalId)).toEqual(["msg-ok"]);
    });

    it("handles missing optional body data in MIME parts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-no-part-data" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "No Part Data" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain" }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("");
    });

    it("continues past nested MIME parts with no matching text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-nested-miss" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Nested Miss" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [
                { mimeType: "multipart/alternative", parts: [{ mimeType: "application/json" }] },
                { mimeType: "text/plain", body: { data: "ZmFsbGJhY2s" } },
              ],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("fallback");
    });

    it("uses current time when the Date header is absent", async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ messages: [{ id: "msg-no-date" }] }),
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              payload: {
                headers: [
                  { name: "From", value: "bank@example.com" },
                  { name: "Subject", value: "No Date" },
                ],
                parts: [{ mimeType: "text/plain", body: { data: "Ym9keQ" } }],
              },
            }),
        });

        const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
          "bank@example.com",
        ]);

        expect(emails[0]?.receivedAt).toBe("2026-04-01T00:00:00.000Z");
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips malformed messages missing required headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-malformed" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [{ name: "From", value: "bank@example.com" }],
              parts: [{ mimeType: "text/plain", body: { data: "Ym9keQ" } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails).toEqual([]);
    });

    it("uses an empty body when base64 decoding fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-bad-body" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Bad Body" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "not valid base64%%%" } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).toBe("");
      expect(mockCaptureError).toHaveBeenCalledOnce();
    });

    it("decodes URL-safe base64 underscores", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-url-safe" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "URL safe" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "_w" } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails[0]?.body).not.toBe("");
    });

    it("follows paginated message lists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-1" }], nextPageToken: "page-2" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "First" },
                { name: "Date", value: "Thu, 05 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "Zmlyc3Q" } }],
            },
          }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: "msg-2" }] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            payload: {
              headers: [
                { name: "From", value: "bank@example.com" },
                { name: "Subject", value: "Second" },
                { name: "Date", value: "Thu, 06 Mar 2026 10:00:00 +0000" },
              ],
              parts: [{ mimeType: "text/plain", body: { data: "c2Vjb25k" } }],
            },
          }),
      });

      const emails = await fetchGmailEmailsWithToken("access-token", "2026-03-01T00:00:00Z", [
        "bank@example.com",
      ]);

      expect(emails.map((email) => email.subject)).toEqual(["First", "Second"]);
      expect(String(mockFetch.mock.calls[2]?.[0])).toContain("pageToken=page-2");
    });
  });
});
