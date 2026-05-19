import { describe, expect, it } from "vitest";
import { shouldRefreshBudgetSuggestions } from "@/features/onboarding/components/BudgetSetupStep.helpers";

const snapshot = ({
  isFetching = true,
}: {
  readonly isFetching?: boolean;
} = {}) => ({
  isFetching,
});

describe("BudgetSetupStep suggestion refresh", () => {
  it("refreshes when email sync finishes without a larger progress count", () => {
    expect(
      shouldRefreshBudgetSuggestions(
        snapshot({ isFetching: true }),
        snapshot({ isFetching: false })
      )
    ).toBe(true);
  });

  it("does not refresh for incremental progress updates while sync is running", () => {
    expect(
      shouldRefreshBudgetSuggestions(snapshot({ isFetching: true }), snapshot({ isFetching: true }))
    ).toBe(false);
  });

  it("does not refresh after sync has already finished", () => {
    expect(
      shouldRefreshBudgetSuggestions(
        snapshot({ isFetching: false }),
        snapshot({ isFetching: false })
      )
    ).toBe(false);
  });
});
