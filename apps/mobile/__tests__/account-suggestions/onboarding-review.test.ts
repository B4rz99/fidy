import { describe, expect, test } from "vitest";
import {
  getDeferredSuggestionReviewState,
  shouldAdvanceOnboardingAfterSuggestionMutation,
} from "@/features/account-suggestions/lib/onboarding-review";
import { ONBOARDING_STEP } from "@/features/onboarding/lib/flow";

describe("account suggestion onboarding review", () => {
  test("advances after create or link only when account review has no remaining suggestions", () => {
    expect(
      shouldAdvanceOnboardingAfterSuggestionMutation({
        onboardingStep: ONBOARDING_STEP.accountReview,
        remainingSuggestionCount: 0,
      })
    ).toBe(true);
    expect(
      shouldAdvanceOnboardingAfterSuggestionMutation({
        onboardingStep: ONBOARDING_STEP.accountReview,
        remainingSuggestionCount: 1,
      })
    ).toBe(false);
    expect(
      shouldAdvanceOnboardingAfterSuggestionMutation({
        onboardingStep: ONBOARDING_STEP.budgetSetup,
        remainingSuggestionCount: 0,
      })
    ).toBe(false);
  });

  test("marks the last skipped visible suggestion as ready to advance", () => {
    const state = getDeferredSuggestionReviewState({
      suggestions: [{ fingerprint: "a" }, { fingerprint: "b" }],
      deferredFingerprints: ["a"],
      skippedFingerprint: "b",
    });

    expect(state.deferredFingerprints).toEqual(["a", "b"]);
    expect(state.hasRemainingVisibleSuggestion).toBe(false);
  });

  test("keeps account review visible when skipped suggestions remain", () => {
    const state = getDeferredSuggestionReviewState({
      suggestions: [{ fingerprint: "a" }, { fingerprint: "b" }],
      deferredFingerprints: [],
      skippedFingerprint: "a",
    });

    expect(state.deferredFingerprints).toEqual(["a"]);
    expect(state.hasRemainingVisibleSuggestion).toBe(true);
  });
});
