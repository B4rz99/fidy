import { describe, expect, it } from "vitest";
import {
  getEmailConnectionChecklist,
  shouldAdvanceAfterEmailConnection,
} from "@/features/onboarding/lib/email-connections";

describe("onboarding email connections", () => {
  it("keeps users on the provider checklist after the first provider connects", () => {
    expect(shouldAdvanceAfterEmailConnection([{ provider: "gmail" }])).toBe(false);
  });

  it("marks connected and missing providers for the checklist", () => {
    expect(getEmailConnectionChecklist([{ provider: "gmail" }])).toEqual([
      { provider: "gmail", connected: true },
      { provider: "outlook", connected: false },
    ]);
  });
});
