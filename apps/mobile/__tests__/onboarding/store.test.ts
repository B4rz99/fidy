import { beforeEach, describe, expect, test } from "vitest";
import { ONBOARDING_STEP } from "@/features/onboarding/lib/flow";
import { useOnboardingStore } from "@/features/onboarding/store";

describe("useOnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      step: ONBOARDING_STEP.welcome,
      isCompleting: false,
      emailSkipped: false,
      shouldReviewAccounts: false,
    });
  });

  test("initial state: step === welcome, isCompleting === false, emailSkipped === false, shouldReviewAccounts === false", () => {
    const initial = useOnboardingStore.getInitialState();
    expect(initial.step).toBe(ONBOARDING_STEP.welcome);
    expect(initial.isCompleting).toBe(false);
    expect(initial.emailSkipped).toBe(false);
    expect(initial.shouldReviewAccounts).toBe(false);
  });

  test("nextStep increments step from welcome to connect email", () => {
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.connectEmail);
  });

  test("nextStep increments through all steps when account review is enabled after sync", () => {
    const { nextStep } = useOnboardingStore.getState();
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.connectEmail);
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.sync);
    useOnboardingStore.setState({ shouldReviewAccounts: true });
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.accountReview);
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.budgetSetup);
    nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.complete);
  });

  test("nextStep clamps at complete", () => {
    useOnboardingStore.setState({ step: ONBOARDING_STEP.complete });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.complete);
  });

  test("completeSync routes to account review when suggestions should be reviewed", () => {
    useOnboardingStore.getState().completeSync(true);
    const state = useOnboardingStore.getState();
    expect(state.shouldReviewAccounts).toBe(true);
    expect(state.step).toBe(ONBOARDING_STEP.accountReview);
  });

  test("completeSync routes to budget setup when suggestions should not be reviewed", () => {
    useOnboardingStore.getState().completeSync(false);
    const state = useOnboardingStore.getState();
    expect(state.shouldReviewAccounts).toBe(false);
    expect(state.step).toBe(ONBOARDING_STEP.budgetSetup);
  });

  test("skipToComplete sets step to complete from any step", () => {
    useOnboardingStore.setState({ step: ONBOARDING_STEP.connectEmail });
    useOnboardingStore.getState().skipToComplete();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.complete);
  });

  test("reset resets step, isCompleting, emailSkipped, and shouldReviewAccounts", () => {
    useOnboardingStore.setState({
      step: ONBOARDING_STEP.accountReview,
      isCompleting: true,
      emailSkipped: true,
      shouldReviewAccounts: true,
    });
    useOnboardingStore.getState().reset();
    const state = useOnboardingStore.getState();
    expect(state.step).toBe(ONBOARDING_STEP.welcome);
    expect(state.isCompleting).toBe(false);
    expect(state.emailSkipped).toBe(false);
    expect(state.shouldReviewAccounts).toBe(false);
  });

  test("setEmailSkipped(true) sets emailSkipped to true", () => {
    useOnboardingStore.getState().setEmailSkipped(true);
    expect(useOnboardingStore.getState().emailSkipped).toBe(true);
  });

  test("nextStep skips sync and account review when emailSkipped is true", () => {
    useOnboardingStore.setState({
      step: ONBOARDING_STEP.connectEmail,
      emailSkipped: true,
      shouldReviewAccounts: true,
    });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.budgetSetup);
  });

  test("nextStep does not skip sync when emailSkipped is false", () => {
    useOnboardingStore.setState({
      step: ONBOARDING_STEP.connectEmail,
      emailSkipped: false,
    });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.sync);
  });
});
