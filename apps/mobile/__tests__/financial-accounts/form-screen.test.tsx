import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderFidy } from "@/__tests__/helpers/render";
import { FinancialAccountFormBody } from "@/features/financial-accounts/components/financial-account-form/FinancialAccountFormBody";
import {
  getFinancialAccountFormScreenState,
  hasInvalidBillingDayInput,
} from "@/features/financial-accounts/lib/form-screen";
import { canFinancialAccountHaveIdentifiers as canKindHaveIdentifiers } from "@/features/financial-accounts/lib/kind";
import { i18n, useLocaleStore } from "@/shared/i18n";
import { requireFinancialAccountId } from "@/shared/types/assertions";
import { createFinancialAccountFixture, createIdentifierFixture } from "./fixtures";

beforeEach(() => {
  i18n.locale = "en";
  useLocaleStore.setState({ locale: "en" });
});

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

  it("does not show identifier controls for cash accounts", () => {
    expect(canKindHaveIdentifiers("cash")).toBe(false);
    expect(canKindHaveIdentifiers("checking")).toBe(true);
    expect(canKindHaveIdentifiers("credit_card")).toBe(true);
  });
});

describe("FinancialAccountFormBody", () => {
  it("renders create form sections, account kind chips, and identifier input", () => {
    const screen = renderFidy(
      <FinancialAccountFormBody existingDetails={null} onManageIdentifiers={null} />
    );

    expect(screen.getByText("Account type")).toBeTruthy();
    expect(screen.getByText("Basic information")).toBeTruthy();
    expect(screen.getByText("Opening balance")).toBeTruthy();
    expect(screen.getByText(/Checking/)).toBeTruthy();
    expect(screen.getByText(/Savings/)).toBeTruthy();
    expect(screen.getByText(/Wallet/)).toBeTruthy();
    expect(screen.getByText(/Cash/)).toBeTruthy();
    expect(screen.getByText(/Credit card/)).toBeTruthy();
    expect(screen.getByText("Identifier")).toBeTruthy();
    expect(screen.getByText("Create account")).toBeTruthy();
  });

  it("exposes account kind chips as a radio group", () => {
    const screen = renderFidy(
      <FinancialAccountFormBody existingDetails={null} onManageIdentifiers={null} />
    );
    const kindGroup = screen.getByA11yLabel("Account type");
    const checkingOption = screen.getByA11yLabel(/Checking/);
    const cashOption = screen.getByA11yLabel(/Cash/);

    expect(kindGroup.props.accessibilityRole).toBe("radiogroup");
    expect(checkingOption.props.accessibilityRole).toBe("radio");
    expect(checkingOption.props.accessibilityState).toMatchObject({ selected: true });
    expect(cashOption.props.accessibilityRole).toBe("radio");
    expect(cashOption.props.accessibilityState).toMatchObject({ selected: false });
  });

  it("renders credit-card billing fields after selecting the credit card kind", () => {
    const screen = renderFidy(
      <FinancialAccountFormBody existingDetails={null} onManageIdentifiers={null} />
    );

    expect(screen.queryByText("Billing profile")).toBeNull();

    screen.pressByText(/Credit card/);

    expect(screen.getByText("Billing profile")).toBeTruthy();
    expect(screen.getByText("Statement closing day")).toBeTruthy();
    expect(screen.getByText("Payment due day")).toBeTruthy();
    expect(screen.getByText("Starting debt")).toBeTruthy();
  });

  it("hides identifier controls for cash accounts", () => {
    const screen = renderFidy(
      <FinancialAccountFormBody existingDetails={null} onManageIdentifiers={null} />
    );

    screen.pressByText(/Cash/);

    expect(screen.queryByText("Identifier")).toBeNull();
  });

  it("renders edit identifiers and calls manage identifiers", () => {
    const onManageIdentifiers = vi.fn();
    const screen = renderFidy(
      <FinancialAccountFormBody
        existingDetails={{
          account: createFinancialAccountFixture({
            name: "Visa gold",
            kind: "credit_card",
            statementClosingDay: 15,
            paymentDueDay: 30,
          }),
          identifiers: [createIdentifierFixture({ value: "**** 1234" })],
          openingBalance: null,
          hasBillingProfileGap: false,
        }}
        onManageIdentifiers={onManageIdentifiers}
      />
    );

    expect(screen.getByText("**** 1234")).toBeTruthy();
    expect(screen.getByText("Manage identifiers")).toBeTruthy();

    screen.pressByText("Manage identifiers");

    expect(onManageIdentifiers).toHaveBeenCalledOnce();
  });
});
