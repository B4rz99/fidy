import { describe, expect, it } from "vitest";
import { getReviewQueueProviderLabel } from "@/features/review-queues/lib/source-labels";

describe("getReviewQueueProviderLabel", () => {
  const t = (key: string) => key;

  it("returns localized provider labels for known email sources", () => {
    expect(getReviewQueueProviderLabel({ sourceId: "email_gmail" }, t)).toBe(
      "financialMeaningReview.providers.gmail"
    );
    expect(getReviewQueueProviderLabel({ sourceId: "email_outlook" }, t)).toBe(
      "financialMeaningReview.providers.outlook"
    );
  });

  it("falls back to the raw source id", () => {
    expect(getReviewQueueProviderLabel({ sourceId: "sms" }, t)).toBe("sms");
  });
});
