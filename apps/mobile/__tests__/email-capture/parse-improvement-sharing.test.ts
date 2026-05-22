import { beforeEach, describe, expect, it, vi } from "vitest";
import { shareEmailParseImprovementRequests } from "@/features/email-capture/services/email-parse-improvement-sharing";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

const {
  mockCaptureError,
  mockCaptureWarning,
  mockEnqueueEmailParseImprovementRequests,
  mockFlushPendingEmailParseImprovementSamples,
} = vi.hoisted(() => ({
  mockCaptureError: vi.fn<(error: unknown) => void>((_error) => undefined),
  mockCaptureWarning: vi.fn<(message: string, context?: unknown) => void>(
    (_message, _context) => undefined
  ),
  mockEnqueueEmailParseImprovementRequests: vi.fn<(input: unknown) => number>(() => 1),
  mockFlushPendingEmailParseImprovementSamples: vi.fn<
    (input: unknown) => Promise<{ readonly shared: number; readonly failed: number }>
  >(() => Promise.resolve({ shared: 1, failed: 0 })),
}));

vi.mock("@/features/email-capture/services/email-parse-improvement-outbox", () => ({
  enqueueEmailParseImprovementRequests: (input: unknown) =>
    mockEnqueueEmailParseImprovementRequests(input),
  flushPendingEmailParseImprovementSamples: (input: unknown) =>
    mockFlushPendingEmailParseImprovementSamples(input),
}));

vi.mock("@/shared/lib", () => ({
  captureError: (error: unknown) => mockCaptureError(error),
  captureWarning: (message: string, context?: unknown) => mockCaptureWarning(message, context),
}));

const db = {} as AnyDb;
const userId = "user-1" as UserId;
const request = {
  parserTemplate: "Subject Body",
  rawText: "Subject\n\nBody",
  senderDomain: "davibank.com",
  source: "email_gmail" as const,
  status: "needs_review" as const,
  confidence: 0.4,
  parseMethod: "llm" as const,
};

describe("shareEmailParseImprovementRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockEnqueueEmailParseImprovementRequests.mockReturnValue(1);
    mockFlushPendingEmailParseImprovementSamples.mockResolvedValue({ shared: 1, failed: 0 });
  });

  it("does not enqueue or flush samples when sharing is disabled", async () => {
    await shareEmailParseImprovementRequests({
      db,
      enabled: false,
      userId,
      requests: [request],
    });

    expect(mockEnqueueEmailParseImprovementRequests).not.toHaveBeenCalled();
    expect(mockFlushPendingEmailParseImprovementSamples).not.toHaveBeenCalled();
  });

  it("logs disabled sharing summaries when debug logging is enabled", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");

    await shareEmailParseImprovementRequests({
      db,
      enabled: false,
      userId,
      requests: [request],
    });

    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.summary", {
      enabled: false,
      requestCount: 1,
      enqueued: 0,
      shared: 0,
      failed: 0,
    });

    consoleLog.mockRestore();
  });

  it("flushes pending samples when sharing is enabled", async () => {
    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
    });

    expect(mockEnqueueEmailParseImprovementRequests).toHaveBeenCalledWith({
      db,
      userId,
      requests: [request],
    });
    expect(mockFlushPendingEmailParseImprovementSamples).toHaveBeenCalledWith({ db, userId });
  });

  it("passes live sharing consent through to the outbox flush", async () => {
    const isSharingEnabled = () => true;

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
      isSharingEnabled,
    });

    expect(mockFlushPendingEmailParseImprovementSamples).toHaveBeenCalledWith({
      db,
      userId,
      isSharingEnabled,
    });
  });

  it("does not enqueue samples when live sharing consent has already been revoked", async () => {
    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
      isSharingEnabled: () => false,
    });

    expect(mockEnqueueEmailParseImprovementRequests).not.toHaveBeenCalled();
    expect(mockFlushPendingEmailParseImprovementSamples).not.toHaveBeenCalled();
  });

  it("logs revoked live sharing consent as disabled when debug logging is enabled", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
      isSharingEnabled: () => false,
    });

    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.summary", {
      enabled: false,
      requestCount: 1,
      enqueued: 0,
      shared: 0,
      failed: 0,
    });

    consoleLog.mockRestore();
  });

  it("captures enqueue failures without rejecting the batch", async () => {
    const error = new Error("enqueue failed");
    mockEnqueueEmailParseImprovementRequests.mockImplementationOnce(() => {
      throw error;
    });

    await expect(
      shareEmailParseImprovementRequests({
        db,
        enabled: true,
        userId,
        requests: [request],
      })
    ).resolves.toBeUndefined();

    expect(mockCaptureError).toHaveBeenCalledWith(error);
    expect(mockCaptureWarning).toHaveBeenCalledWith(
      "email_parse_improvement_sample_enqueue_failed",
      { errorType: "Error" }
    );
  });

  it("handles enqueue failures per request without dropping the whole invocation", async () => {
    const error = new Error("enqueue failed");
    mockEnqueueEmailParseImprovementRequests
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockReturnValueOnce(1);

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [
        request,
        {
          ...request,
          parserTemplate: "Pago en [MERCHANT] por [AMOUNT]",
          rawText: "Pago en Comercio por $123",
        },
      ],
    });

    expect(mockEnqueueEmailParseImprovementRequests).toHaveBeenCalledTimes(2);
    expect(mockFlushPendingEmailParseImprovementSamples).toHaveBeenCalledWith({ db, userId });
    expect(mockCaptureError).toHaveBeenCalledWith(error);
  });

  it("captures non-error enqueue failures as unknown", async () => {
    mockEnqueueEmailParseImprovementRequests.mockImplementationOnce(() => {
      throw "enqueue failed";
    });

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
    });

    expect(mockCaptureWarning).toHaveBeenCalledWith(
      "email_parse_improvement_sample_enqueue_failed",
      { errorType: "unknown" }
    );
  });

  it("logs enabled sharing summaries when debug logging is enabled", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");
    mockEnqueueEmailParseImprovementRequests.mockReturnValueOnce(2);
    mockFlushPendingEmailParseImprovementSamples.mockResolvedValueOnce({ shared: 1, failed: 1 });

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
    });

    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.summary", {
      enabled: true,
      requestCount: 1,
      enqueued: 2,
      shared: 1,
      failed: 1,
    });

    consoleLog.mockRestore();
  });

  it("captures outbox flush failures without rejecting the batch", async () => {
    const error = new Error("share failed");
    mockFlushPendingEmailParseImprovementSamples.mockRejectedValueOnce(error);

    await expect(
      shareEmailParseImprovementRequests({
        db,
        enabled: true,
        userId,
        requests: [request],
      })
    ).resolves.toBeUndefined();

    expect(mockCaptureError).toHaveBeenCalledWith(error);
    expect(mockCaptureWarning).toHaveBeenCalledWith("email_parse_improvement_sample_share_failed", {
      errorType: "Error",
    });
  });

  it("does not report newly enqueued rows as failed when a full outbox flush throws", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv("EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG", "1");
    mockEnqueueEmailParseImprovementRequests.mockReturnValueOnce(3);
    mockFlushPendingEmailParseImprovementSamples.mockRejectedValueOnce(new Error("share failed"));

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
    });

    expect(consoleLog).toHaveBeenCalledWith("[email-capture] parse-improvement.summary", {
      enabled: true,
      requestCount: 1,
      enqueued: 3,
      shared: 0,
      failed: 0,
    });

    consoleLog.mockRestore();
  });

  it("captures non-error outbox flush failures as unknown", async () => {
    mockFlushPendingEmailParseImprovementSamples.mockRejectedValueOnce("share failed");

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
    });

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_parse_improvement_sample_share_failed", {
      errorType: "unknown",
    });
  });

  it("warns when individual pending samples fail to flush", async () => {
    mockFlushPendingEmailParseImprovementSamples.mockResolvedValueOnce({ shared: 0, failed: 1 });

    await shareEmailParseImprovementRequests({
      db,
      enabled: true,
      userId,
      requests: [request],
    });

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_parse_improvement_sample_share_failed", {
      errorType: "unknown",
    });
  });
});
