import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs onboarding events with the onboarding prefix", () => {
    logOnboardingEvent("started", { step: 1 });

    expect(console.info).toHaveBeenCalledWith("[onboarding]", "started", { step: 1 });
  });

  it("captures onboarding events with source and event fields", () => {
    captureOnboardingEvent("completed", { skipped: false });

    expect(mockCapturePipelineEvent).toHaveBeenCalledWith({
      skipped: false,
      source: "onboarding",
      event: "completed",
    });
  });

  it("tracks onboarding events through logging and capture", () => {
    trackOnboardingEvent("sync_complete", { shouldReviewAccounts: true });

    expect(console.info).toHaveBeenCalledWith("[onboarding]", "sync_complete", {
      shouldReviewAccounts: true,
    });
    expect(mockCapturePipelineEvent).toHaveBeenCalledWith({
      shouldReviewAccounts: true,
      source: "onboarding",
      event: "sync_complete",
    });
  });
});
