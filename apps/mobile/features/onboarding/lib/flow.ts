export const ONBOARDING_STEP = {
  welcome: 1,
  connectEmail: 2,
  sync: 3,
  accountReview: 4,
  budgetSetup: 5,
  complete: 6,
} as const;

export type OnboardingStep = (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];

type NextOnboardingStepInput = {
  readonly step: OnboardingStep;
  readonly emailSkipped: boolean;
  readonly shouldReviewAccounts: boolean;
};

export function getVisibleOnboardingStepCount(shouldReviewAccounts: boolean) {
  return shouldReviewAccounts ? ONBOARDING_STEP.complete : ONBOARDING_STEP.complete - 1;
}

export function getVisibleOnboardingStepIndex(step: OnboardingStep, shouldReviewAccounts: boolean) {
  return !shouldReviewAccounts && step >= ONBOARDING_STEP.budgetSetup ? step - 1 : step;
}

export function getNextOnboardingStep({
  step,
  emailSkipped,
  shouldReviewAccounts,
}: NextOnboardingStepInput): OnboardingStep {
  if (step === ONBOARDING_STEP.connectEmail && emailSkipped) {
    return ONBOARDING_STEP.budgetSetup;
  }

  if (step === ONBOARDING_STEP.sync) {
    return shouldReviewAccounts ? ONBOARDING_STEP.accountReview : ONBOARDING_STEP.budgetSetup;
  }

  return Math.min(step + 1, ONBOARDING_STEP.complete) as OnboardingStep;
}
