import { beforeEach, describe, expect, test, vi } from "vitest";
import { ONBOARDING_STEP } from "@/features/onboarding/lib/flow";
import { useLocalOnboardingState } from "@/features/onboarding/lib/local-onboarding-state";
import { useOnboardingStore } from "@/features/onboarding/store";

const { mockLogOnboardingEvent, mockMarkOnboardingComplete, mockTrackOnboardingEvent } = vi.hoisted(
  () => ({
    mockLogOnboardingEvent: vi.fn(),
    mockMarkOnboardingComplete: vi.fn(() => Promise.resolve()),
    mockTrackOnboardingEvent: vi.fn(),
  })
);

vi.mock("@/features/onboarding/lib/telemetry", () => ({
  logOnboardingEvent: (...args: unknown[]) => mockLogOnboardingEvent(...args),
  trackOnboardingEvent: (...args: unknown[]) => mockTrackOnboardingEvent(...args),
}));

vi.mock("@/features/onboarding/lib/check-onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/features/onboarding/lib/check-onboarding")>(
    "@/features/onboarding/lib/check-onboarding"
  );

  return {
    ...actual,
    markOnboardingComplete: () => mockMarkOnboardingComplete(),
  };
});

describe("useOnboardingStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocalOnboardingState.setState({ isComplete: false });
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
    expect(mockLogOnboardingEvent).toHaveBeenCalledWith("step_transition", {
      from: "welcome",
      to: "connectEmail",
      emailSkipped: false,
      shouldReviewAccounts: false,
    });
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

  test("nextStep safely logs unexpected step values", () => {
    useOnboardingStore.setState({ step: 999 as never });

    useOnboardingStore.getState().nextStep();

    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.complete);
    expect(mockLogOnboardingEvent).toHaveBeenCalledWith("step_transition", {
      from: "unknown_999",
      to: "complete",
      emailSkipped: false,
      shouldReviewAccounts: false,
    });
  });

  test("completeSync routes to account review when suggestions should be reviewed", () => {
    useOnboardingStore.setState({ emailSkipped: true });

    useOnboardingStore.getState().completeSync(true);
    const state = useOnboardingStore.getState();
    expect(state.shouldReviewAccounts).toBe(true);
    expect(state.step).toBe(ONBOARDING_STEP.accountReview);
    expect(state.emailSkipped).toBe(true);
    expect(mockTrackOnboardingEvent).toHaveBeenCalledWith("sync_complete", {
      shouldReviewAccounts: true,
    });
  });

  test("completeSync routes to budget setup when suggestions should not be reviewed", () => {
    useOnboardingStore.getState().completeSync(false);
    const state = useOnboardingStore.getState();
    expect(state.shouldReviewAccounts).toBe(false);
    expect(state.step).toBe(ONBOARDING_STEP.budgetSetup);
    expect(mockTrackOnboardingEvent).toHaveBeenCalledWith("sync_complete", {
      shouldReviewAccounts: false,
    });
  });

  test("skipToComplete sets step to complete from any step", () => {
    useOnboardingStore.setState({ step: ONBOARDING_STEP.connectEmail });
    useOnboardingStore.getState().skipToComplete();
    expect(useOnboardingStore.getState().step).toBe(ONBOARDING_STEP.complete);
    expect(mockTrackOnboardingEvent).toHaveBeenCalledWith("skip_to_complete");
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
    expect(mockLogOnboardingEvent).toHaveBeenCalledWith("reset");
  });

  test("setEmailSkipped(true) sets emailSkipped to true", () => {
    useOnboardingStore.getState().setEmailSkipped(true);
    expect(useOnboardingStore.getState().emailSkipped).toBe(true);
    expect(mockTrackOnboardingEvent).toHaveBeenCalledWith("email_skipped", { skipped: true });
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

  test("completeOnboarding updates auth-derived onboarding state after persisting the flag", async () => {
    await useOnboardingStore.getState().completeOnboarding();

    expect(mockMarkOnboardingComplete).toHaveBeenCalledOnce();
    expect(useLocalOnboardingState.getState().isComplete).toBe(true);
    expect(useOnboardingStore.getState().isCompleting).toBe(false);
    expect(mockLogOnboardingEvent).toHaveBeenCalledWith("complete_start");
    expect(mockTrackOnboardingEvent).toHaveBeenCalledWith("complete_success");
  });

  test("completeOnboarding exposes the completing flag while persistence is pending", async () => {
    let resolveComplete!: () => void;
    mockMarkOnboardingComplete.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveComplete = resolve;
      })
    );

    const promise = useOnboardingStore.getState().completeOnboarding();

    expect(useOnboardingStore.getState().isCompleting).toBe(true);
    resolveComplete();
    await promise;
    expect(useOnboardingStore.getState().isCompleting).toBe(false);
  });
});
