import { describe, expect, it } from "vitest";
import {
  getNextOnboardingStep,
  getVisibleOnboardingStepCount,
  getVisibleOnboardingStepIndex,
  ONBOARDING_STEP,
} from "@/features/onboarding/lib/flow";

describe("onboarding flow helpers", () => {
  it("skips account review and continues to budget setup when no strong suggestions exist", () => {
    expect(
      getNextOnboardingStep({
        step: ONBOARDING_STEP.sync,
        emailSkipped: false,
        shouldReviewAccounts: false,
      })
    ).toBe(ONBOARDING_STEP.budgetSetup);
  });

  it("keeps the visible onboarding step count at five when account review is skipped", () => {
    expect(getVisibleOnboardingStepCount(false)).toBe(5);
    expect(getVisibleOnboardingStepIndex(ONBOARDING_STEP.connectEmail, false)).toBe(2);
    expect(getVisibleOnboardingStepIndex(ONBOARDING_STEP.budgetSetup, false)).toBe(4);
    expect(getVisibleOnboardingStepIndex(ONBOARDING_STEP.complete, false)).toBe(5);
  });

  it("shows six visible steps when account review is part of the flow", () => {
    expect(getVisibleOnboardingStepCount(true)).toBe(6);
    expect(getVisibleOnboardingStepIndex(ONBOARDING_STEP.accountReview, true)).toBe(4);
    expect(getVisibleOnboardingStepIndex(ONBOARDING_STEP.complete, true)).toBe(6);
  });

  it("only skips from connect email when email was skipped", () => {
    expect(
      getNextOnboardingStep({
        step: ONBOARDING_STEP.welcome,
        emailSkipped: true,
        shouldReviewAccounts: false,
      })
    ).toBe(ONBOARDING_STEP.connectEmail);
    expect(
      getNextOnboardingStep({
        step: ONBOARDING_STEP.connectEmail,
        emailSkipped: true,
        shouldReviewAccounts: false,
      })
    ).toBe(ONBOARDING_STEP.budgetSetup);
  });
});
