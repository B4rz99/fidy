import { create } from "zustand";
import { markOnboardingComplete } from "./lib/check-onboarding";
import { getNextOnboardingStep, ONBOARDING_STEP, type OnboardingStep } from "./lib/flow";
import { useLocalOnboardingState } from "./lib/local-onboarding-state";

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

export const TOTAL_STEPS = ONBOARDING_STEP.complete;

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set) => ({
  step: ONBOARDING_STEP.welcome,
  isCompleting: false,
  emailSkipped: false,
  shouldReviewAccounts: false,

  nextStep: () => {
    set((s) => {
      return {
        step: getNextOnboardingStep({
          step: s.step,
          emailSkipped: s.emailSkipped,
          shouldReviewAccounts: s.shouldReviewAccounts,
        }),
      };
    });
  },

  completeSync: (shouldReviewAccounts) => {
    set({
      shouldReviewAccounts,
      step: getNextOnboardingStep({
        step: ONBOARDING_STEP.sync,
        emailSkipped: false,
        shouldReviewAccounts,
      }),
    });
  },

  skipToComplete: () => {
    set({ step: ONBOARDING_STEP.complete });
  },

  setEmailSkipped: (skipped) => {
    set({ emailSkipped: skipped });
  },

  completeOnboarding: async () => {
    set({ isCompleting: true });
    try {
      await markOnboardingComplete();
      useLocalOnboardingState.getState().setIsComplete(true);
    } finally {
      set({ isCompleting: false });
    }
  },

  reset: () => {
    set({
      step: ONBOARDING_STEP.welcome,
      isCompleting: false,
      emailSkipped: false,
      shouldReviewAccounts: false,
    });
  },
}));
