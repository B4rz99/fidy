import { create } from "zustand";
import { useAuthStore } from "@/features/auth";
import { markOnboardingComplete } from "./lib/check-onboarding";

type OnboardingState = {
  step: number;
  isCompleting: boolean;
  emailSkipped: boolean;
};

type OnboardingActions = {
  nextStep: () => void;
  skipToComplete: () => void;
  setEmailSkipped: (skipped: boolean) => void;
  completeOnboarding: () => Promise<void>;
  reset: () => void;
};

export const TOTAL_STEPS = 5;

export const useOnboardingStore = create<OnboardingState & OnboardingActions>((set) => ({
  step: 1,
  isCompleting: false,
  emailSkipped: false,

  nextStep: () => {
    set((s) => {
      const next = Math.min(s.step + 1, TOTAL_STEPS);
      // Skip sync step (3) when email was skipped — nothing to sync
      const resolved = next === 3 && s.emailSkipped ? 4 : next;
      return { step: resolved };
    });
  },

  skipToComplete: () => {
    set({ step: TOTAL_STEPS });
  },

  setEmailSkipped: (skipped) => {
    set({ emailSkipped: skipped });
  },

  completeOnboarding: async () => {
    set({ isCompleting: true });
    try {
      await markOnboardingComplete();
      // Refresh session so root layout detects updated user_metadata
      await useAuthStore.getState().restoreSession();
    } finally {
      set({ isCompleting: false });
    }
  },

  reset: () => {
    set({ step: 1, isCompleting: false, emailSkipped: false });
  },
}));
