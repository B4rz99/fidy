import { describe, expect, it } from "vitest";
import { getFinancialAccountKindIcon } from "@/features/review-queues/lib/account-presentation";
import { CreditCard, Landmark, PiggyBank, Wallet } from "@/shared/components/icons";

describe("account presentation", () => {
  it("uses the credit-card icon for credit cards", () => {
    expect(getFinancialAccountKindIcon("credit_card")).toBe(CreditCard);
  });

  it("uses the wallet icon for wallet-like account kinds", () => {
    expect(getFinancialAccountKindIcon("wallet")).toBe(Wallet);
    expect(getFinancialAccountKindIcon("cash")).toBe(Wallet);
  });

  it("uses the piggy-bank icon for savings accounts", () => {
    expect(getFinancialAccountKindIcon("savings")).toBe(PiggyBank);
  });

  it("falls back to the bank icon for other or unknown kinds", () => {
    expect(getFinancialAccountKindIcon("checking")).toBe(Landmark);
    expect(getFinancialAccountKindIcon("unexpected-kind")).toBe(Landmark);
  });
});
