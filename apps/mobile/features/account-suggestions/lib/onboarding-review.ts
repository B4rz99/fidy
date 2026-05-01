import { ONBOARDING_STEP, type OnboardingStep } from "@/features/onboarding/lib/flow";

type SuggestionFingerprint = {
  readonly fingerprint: string;
};

export function shouldAdvanceOnboardingAfterSuggestionMutation(input: {
  readonly onboardingStep: OnboardingStep;
  readonly remainingSuggestionCount: number;
}) {
  return (
    input.onboardingStep === ONBOARDING_STEP.accountReview && input.remainingSuggestionCount === 0
  );
}

export function getDeferredSuggestionReviewState(input: {
  readonly suggestions: readonly SuggestionFingerprint[];
  readonly deferredFingerprints: readonly string[];
  readonly skippedFingerprint: string;
}) {
  const deferredFingerprints = Array.from(
    new Set([...input.deferredFingerprints, input.skippedFingerprint])
  );
  const hasRemainingVisibleSuggestion = input.suggestions.some(
    (suggestion) => !deferredFingerprints.includes(suggestion.fingerprint)
  );

  return {
    deferredFingerprints,
    hasRemainingVisibleSuggestion,
  };
}
