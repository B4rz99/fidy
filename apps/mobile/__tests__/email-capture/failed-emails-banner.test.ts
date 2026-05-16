import { describe, expect, it, vi } from "vitest";
import { getFailedEmailsBannerTitle } from "@/features/email-capture/components/FailedEmailsBanner";

describe("FailedEmailsBanner", () => {
  it("displays the unprocessed email count from failed source events", () => {
    const t = vi.fn((key: string, options?: { count: number }) => `${key}:${options?.count}`);

    expect(getFailedEmailsBannerTitle(t, 3)).toBe("emailCapture.unprocessedEmails:3");
    expect(t).toHaveBeenCalledWith("emailCapture.unprocessedEmails", { count: 3 });
  });
});
