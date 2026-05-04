import { beforeEach, describe, expect, it, vi } from "vitest";
import { shareEmailParseImprovementRequests } from "@/features/email-capture/services/email-parse-improvement-sharing";
import type { UserId } from "@/shared/types/branded";

const { mockCaptureError, mockShareCaptureParseImprovementSample } = vi.hoisted(() => ({
  mockCaptureError: vi.fn((_error: unknown) => undefined),
  mockShareCaptureParseImprovementSample: vi.fn((_sample: unknown) => Promise.resolve()),
}));

vi.mock("@/features/capture-sources/diagnostics.public", () => ({
  shareCaptureParseImprovementSample: (sample: unknown) =>
    mockShareCaptureParseImprovementSample(sample),
}));

vi.mock("@/shared/lib", () => ({
  captureError: (error: unknown) => mockCaptureError(error),
}));

const request = {
  rawText: "Subject\n\nBody",
  source: "email_gmail" as const,
  status: "needs_review" as const,
  confidence: 0.4,
  parseMethod: "llm" as const,
};

describe("shareEmailParseImprovementRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShareCaptureParseImprovementSample.mockResolvedValue(undefined);
  });

  it("does not share samples when sharing is disabled", async () => {
    await shareEmailParseImprovementRequests({
      enabled: false,
      userId: "user-1" as UserId,
      requests: [request],
    });

    expect(mockShareCaptureParseImprovementSample).not.toHaveBeenCalled();
  });

  it("shares enabled samples with user consent", async () => {
    await shareEmailParseImprovementRequests({
      enabled: true,
      userId: "user-1" as UserId,
      requests: [request],
    });

    expect(mockShareCaptureParseImprovementSample).toHaveBeenCalledWith({
      ...request,
      userId: "user-1",
      consent: true,
    });
  });

  it("captures individual sharing failures without rejecting the batch", async () => {
    const error = new Error("share failed");
    mockShareCaptureParseImprovementSample.mockRejectedValueOnce(error);

    await expect(
      shareEmailParseImprovementRequests({
        enabled: true,
        userId: "user-1" as UserId,
        requests: [request],
      })
    ).resolves.toBeUndefined();

    expect(mockCaptureError).toHaveBeenCalledWith(error);
  });
});
