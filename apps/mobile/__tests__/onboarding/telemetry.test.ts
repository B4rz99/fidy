import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureOnboardingEvent,
  logOnboardingEvent,
  trackOnboardingEvent,
} from "@/features/onboarding/lib/telemetry";

const { mockCapturePipelineEvent } = vi.hoisted(() => ({
  mockCapturePipelineEvent: vi.fn(),
}));

vi.mock("@/shared/lib", () => ({
  capturePipelineEvent: (...args: unknown[]) => mockCapturePipelineEvent(...args),
}));

describe("onboarding telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps onboarding logs local-only", () => {
    logOnboardingEvent("started", { step: 1 });

    expect(mockCapturePipelineEvent).not.toHaveBeenCalled();
  });

  it("captures onboarding events with source and event fields", () => {
    captureOnboardingEvent("completed", { skipped: false });

    expect(mockCapturePipelineEvent).toHaveBeenCalledWith({
      skipped: false,
      source: "onboarding",
      event: "completed",
    });
  });

  it("tracks onboarding events through telemetry capture", () => {
    trackOnboardingEvent("sync_complete", { shouldReviewAccounts: true });

    expect(mockCapturePipelineEvent).toHaveBeenCalledWith({
      shouldReviewAccounts: true,
      source: "onboarding",
      event: "sync_complete",
    });
  });
});
