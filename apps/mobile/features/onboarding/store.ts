import { create } from "zustand";
import { markOnboardingComplete } from "./lib/check-onboarding";
import { getNextOnboardingStep, ONBOARDING_STEP, type OnboardingStep } from "./lib/flow";
import { useLocalOnboardingState } from "./lib/local-onboarding-state";
import { logOnboardingEvent, trackOnboardingEvent } from "./lib/telemetry";

type OnboardingState = {
  step: OnboardingStep;
  isCompleting: boolean;
  emailSkipped: boolean;
  shouldReviewAccounts: boolean;
};

type OnboardingActions = {
  nextStep: () => void;
  completeSync: (shouldReviewAccounts: boolean) => void;
  skipToComplete: () => void;
  setEmailSkipped: (skipped: boolean) => void;
  completeOnboarding: () => Promise<void>;
  reset: () => void;
};

function getStepName(step: OnboardingStep): string {
  return (
    Object.entries(ONBOARDING_STEP).find(([, value]) => value === step)?.[0] ?? `unknown_${step}`
  );
}

export const TOTAL_STEPS = ONBOARDING_STEP.complete;

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set) => ({
  step: ONBOARDING_STEP.welcome,
  isCompleting: false,
  emailSkipped: false,
  shouldReviewAccounts: false,

  nextStep: () => {
    set((s) => {
      const nextStep = getNextOnboardingStep({
        step: s.step,
        emailSkipped: s.emailSkipped,
        shouldReviewAccounts: s.shouldReviewAccounts,
      });
      logOnboardingEvent("step_transition", {
        from: getStepName(s.step),
        to: getStepName(nextStep),
        emailSkipped: s.emailSkipped,
        shouldReviewAccounts: s.shouldReviewAccounts,
      });
      return {
        step: nextStep,
      };
    });
  },

  completeSync: (shouldReviewAccounts) => {
    trackOnboardingEvent("sync_complete", { shouldReviewAccounts });
    set({
      shouldReviewAccounts,
      step: getNextOnboardingStep({
        step: ONBOARDING_STEP.sync,
        // Sync routing ignores emailSkipped; this literal documents that sync was not skipped.
        // Stryker disable next-line BooleanLiteral
        emailSkipped: false,
        shouldReviewAccounts,
      }),
    });
  },

  skipToComplete: () => {
    trackOnboardingEvent("skip_to_complete");
    set({ step: ONBOARDING_STEP.complete });
  },

  setEmailSkipped: (skipped) => {
    trackOnboardingEvent("email_skipped", { skipped });
    set({ emailSkipped: skipped });
  },

  completeOnboarding: async () => {
    logOnboardingEvent("complete_start");
    set({ isCompleting: true });
    try {
      await markOnboardingComplete();
      useLocalOnboardingState.getState().setIsComplete(true);
      trackOnboardingEvent("complete_success");
    } finally {
      set({ isCompleting: false });
    }
  },

  reset: () => {
    logOnboardingEvent("reset");
    set({
      step: ONBOARDING_STEP.welcome,
      isCompleting: false,
      emailSkipped: false,
      shouldReviewAccounts: false,
    });
  },
}));
