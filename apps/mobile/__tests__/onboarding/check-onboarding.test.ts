// biome-ignore-all lint/style/useNamingConvention: Supabase API uses snake_case for user_metadata fields
import type { Session } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";
import { isOnboardingComplete } from "@/features/onboarding/lib/check-onboarding";

const makeSession = (metadata?: Record<string, unknown>) =>
  ({
    user: {
      id: "user-123",
      user_metadata: metadata ?? {},
    },
  }) as unknown as Session;

describe("isOnboardingComplete", () => {
  test("returns true when onboarding_completed is true", () => {
    const session = makeSession({ onboarding_completed: true });
    expect(isOnboardingComplete(session)).toBe(true);
  });

  test("returns false for null session", () => {
    expect(isOnboardingComplete(null)).toBe(false);
  });

  test("returns false when metadata is missing", () => {
    const session = makeSession();
    expect(isOnboardingComplete(session)).toBe(false);
  });

  test("returns false when onboarding_completed is false", () => {
    const session = makeSession({ onboarding_completed: false });
    expect(isOnboardingComplete(session)).toBe(false);
  });
});
