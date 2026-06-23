import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockParseNotification } = vi.hoisted(() => ({
  mockParseNotification: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/email-capture/parse-service.public", () => ({
  isCaptureNeedsReviewError: (error: unknown) =>
    error instanceof Error && error.message === "capture_needs_review",
  retryableReviewableParseEmailService: {
    parseNotification: (...args: any[]) => mockParseNotification(...args),
  },
}));

describe("parseNotificationApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces ambiguous notification AI results as needs_review", async () => {
    const reviewError = Object.assign(new Error("capture_needs_review"), {
      reason: "amount and merchant conflict",
      confidence: 0.42,
    });
    mockParseNotification.mockRejectedValueOnce(reviewError);
    const { parseNotificationApi } =
      await import("@/features/capture-sources/services/parse-notification-api");

    await expect(parseNotificationApi("ambiguous notification")).resolves.toEqual({
      kind: "needs_review",
      reason: "amount and merchant conflict",
      confidence: 0.42,
    });
    expect(mockParseNotification).toHaveBeenCalledWith("ambiguous notification");
  });

  it("surfaces notification AI unavailability as retryable", async () => {
    mockParseNotification.mockRejectedValueOnce(new Error("Edge Function unavailable"));
    const { parseNotificationApi } =
      await import("@/features/capture-sources/services/parse-notification-api");

    await expect(parseNotificationApi("unparsed notification")).rejects.toThrow(
      "Edge Function unavailable"
    );
    expect(mockParseNotification).toHaveBeenCalledWith("unparsed notification");
  });
});
