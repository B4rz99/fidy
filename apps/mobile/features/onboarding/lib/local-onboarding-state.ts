import { create } from "zustand";
import { getOnboardingCompleteFromStore } from "./check-onboarding";

type LocalOnboardingState = {
  isComplete: boolean;
  setIsComplete: (isComplete: boolean) => void;
};

export const useLocalOnboardingState = create<LocalOnboardingState>((set) => ({
  isComplete: getOnboardingCompleteFromStore(),
  setIsComplete: (isComplete) => {
    set({ isComplete });
  },
}));
