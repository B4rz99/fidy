import { describe, expect, it } from "vitest";
import {
  getFinancialAccountFormScreenState,
  hasInvalidBillingDayInput,
} from "@/features/financial-accounts/lib/form-screen";
import { requireFinancialAccountId } from "@/shared/types/assertions";

describe("financial account form helpers", () => {
  it("ignores stale billing-day input after switching away from credit cards", () => {
    expect(
      hasInvalidBillingDayInput({
        kind: "checking",
        statementClosingDay: Number.NaN,
        paymentDueDay: 42,
      })
    ).toBe(false);
  });

  it("rejects invalid billing-day input for credit cards", () => {
    expect(
      hasInvalidBillingDayInput({
        kind: "credit_card",
        statementClosingDay: 0,
        paymentDueDay: 32,
      })
    ).toBe(true);
  });

  it("treats missing edit records as missing instead of loading", () => {
    expect(
      getFinancialAccountFormScreenState({
        accountId: requireFinancialAccountId("fa-missing"),
        lookupStatus: "missing",
      })
    ).toBe("missing");
  });

  it("keeps create mode separate from edit lookup state", () => {
    expect(
      getFinancialAccountFormScreenState({
        accountId: null,
        lookupStatus: "loading",
      })
    ).toBe("create");
  });
});
