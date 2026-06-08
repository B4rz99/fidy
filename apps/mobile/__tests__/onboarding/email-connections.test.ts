import { describe, expect, it } from "vitest";
import {
  getEmailConnectionChecklist,
  hasConnectedEmailAccount,
} from "@/features/onboarding/lib/email-connections";

describe("onboarding email connections", () => {
  it("marks connected and missing providers for the checklist", () => {
    expect(getEmailConnectionChecklist([{ provider: "gmail" }])).toEqual([
      { provider: "gmail", connected: true },
      { provider: "outlook", connected: false },
    ]);
  });

  it("only treats supported providers as connected", () => {
    expect(hasConnectedEmailAccount([{ provider: "imap" }])).toBe(false);
    expect(hasConnectedEmailAccount([{ provider: "outlook" }])).toBe(true);
    expect(hasConnectedEmailAccount([{ provider: "imap" }, { provider: "gmail" }])).toBe(true);
  });
});
