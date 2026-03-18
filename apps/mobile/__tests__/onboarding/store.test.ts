import { beforeEach, describe, expect, test } from "vitest";
import { useOnboardingStore } from "@/features/onboarding/store";

describe("useOnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      step: 1,
      isCompleting: false,
      emailSkipped: false,
    });
  });

  test("initial state: step === 1, isCompleting === false, emailSkipped === false", () => {
    const initial = useOnboardingStore.getInitialState();
    expect(initial.step).toBe(1);
    expect(initial.isCompleting).toBe(false);
    expect(initial.emailSkipped).toBe(false);
  });

  test("nextStep increments step from 1 to 2", () => {
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(2);
  });

  test("nextStep increments through all steps: 1→2→3→4→5", () => {
    const { nextStep } = useOnboardingStore.getState();
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(2);
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(3);
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(4);
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(5);
  });

  test("nextStep clamps at 5", () => {
    useOnboardingStore.setState({ step: 5 });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(5);
  });

  test("skipToComplete sets step to 5 from any step", () => {
    useOnboardingStore.setState({ step: 2 });
    useOnboardingStore.getState().skipToComplete();
    expect(useOnboardingStore.getState().step).toBe(5);
  });

  test("reset resets step to 1, isCompleting to false, emailSkipped to false", () => {
    useOnboardingStore.setState({ step: 4, isCompleting: true, emailSkipped: true });
    useOnboardingStore.getState().reset();
    const state = useOnboardingStore.getState();
    expect(state.step).toBe(1);
    expect(state.isCompleting).toBe(false);
    expect(state.emailSkipped).toBe(false);
  });

  test("setEmailSkipped(true) sets emailSkipped to true", () => {
    useOnboardingStore.getState().setEmailSkipped(true);
    expect(useOnboardingStore.getState().emailSkipped).toBe(true);
  });

  test("nextStep skips step 3 (sync) when emailSkipped is true", () => {
    useOnboardingStore.setState({ step: 2, emailSkipped: true });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(4);
  });

  test("nextStep does not skip step 3 when emailSkipped is false", () => {
    useOnboardingStore.setState({ step: 2, emailSkipped: false });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(3);
  });
});
