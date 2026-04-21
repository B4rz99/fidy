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

export function getNextOnboardingStep(input: NextOnboardingStepInput): OnboardingStep {
  if (input.step === ONBOARDING_STEP.connectEmail && input.emailSkipped) {
    return ONBOARDING_STEP.budgetSetup;
  }

  if (input.step === ONBOARDING_STEP.sync) {
    return input.shouldReviewAccounts ? ONBOARDING_STEP.accountReview : ONBOARDING_STEP.budgetSetup;
  }

  return Math.min(input.step + 1, ONBOARDING_STEP.complete) as OnboardingStep;
}
