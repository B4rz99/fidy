import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRetryEmailBody } from "@/features/email-capture/services/email-pipeline";
import type { ProcessedSourceEventRow } from "@/features/email-capture/public";
import type { ProcessedSourceEventId, UserId } from "@/shared/types/branded";

const mockFetchEmailById = vi.fn<(...args: any[]) => any>();

vi.mock("@/features/email-capture/services/email-adapter-registry", () => ({
  getAdapter: () => ({ fetchEmailById: mockFetchEmailById }),
}));

const sourceEvent = (overrides: Partial<ProcessedSourceEventRow>): ProcessedSourceEventRow => ({
  id: "pse-1" as ProcessedSourceEventId,
  userId: "user-1" as UserId,
  sourceFamily: "email",
  sourceId: "email_gmail",
  sourceEventId: "msg-1",
  status: "pending_retry",
  failureReason: null,
  retryCount: 1,
  nextRetryAt: null,
  transactionId: null,
  confidence: null,
  receivedAt: "2026-05-18T02:00:00.000Z" as ProcessedSourceEventRow["receivedAt"],
  processedAt: "2026-05-18T02:00:00.000Z" as ProcessedSourceEventRow["processedAt"],
  createdAt: "2026-05-18T02:00:00.000Z" as ProcessedSourceEventRow["createdAt"],
  updatedAt: "2026-05-18T02:00:00.000Z" as ProcessedSourceEventRow["updatedAt"],
  deletedAt: null,
  ...overrides,
});

describe("email retry body resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID = "gmail-client";
    process.env.EXPO_PUBLIC_OUTLOOK_CLIENT_ID = "outlook-client";
  });

  it("refetches Gmail retry bodies by source event id", async () => {
    mockFetchEmailById.mockResolvedValueOnce({ body: "gmail body" });

    await expect(
      resolveRetryEmailBody({} as never, "user-1" as UserId, sourceEvent({}))
    ).resolves.toBe("gmail body");
    expect(mockFetchEmailById).toHaveBeenCalledWith("gmail-client", "msg-1");
  });

  it("refetches Outlook retry bodies by source event id", async () => {
    mockFetchEmailById.mockResolvedValueOnce({ body: "outlook body" });

    await expect(
      resolveRetryEmailBody(
        {} as never,
        "user-1" as UserId,
        sourceEvent({ sourceId: "email_outlook" })
      )
    ).resolves.toBe("outlook body");
    expect(mockFetchEmailById).toHaveBeenCalledWith("outlook-client", "msg-1");
  });

  it("returns null for unsupported retry source ids or provider failures", async () => {
    await expect(
      resolveRetryEmailBody({} as never, "user-1" as UserId, sourceEvent({ sourceId: "other" }))
    ).resolves.toBeNull();

    mockFetchEmailById.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(
      resolveRetryEmailBody({} as never, "user-1" as UserId, sourceEvent({}))
    ).resolves.toBeNull();
  });
});
