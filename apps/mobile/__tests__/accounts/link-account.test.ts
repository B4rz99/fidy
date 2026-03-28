import { describe, expect, it } from "vitest";
import { linkTransactionToAccount } from "@/features/accounts/lib/link-account";
import type { BankKey, StoredAccount } from "@/features/accounts/schema";
import type { AccountId } from "@/shared/types/branded";

const makeAccount = (
  id: string,
  bankKey: BankKey,
  identifiers: readonly string[],
  isDefault = false
): Pick<StoredAccount, "id" | "bankKey" | "identifiers" | "isDefault"> => ({
  id: id as AccountId,
  bankKey,
  identifiers,
  isDefault,
});

describe("linkTransactionToAccount", () => {
  const defaultAccount = makeAccount("acct-default", "other", [], true);

  it("returns default account when no bank_key resolved", () => {
    const result = linkTransactionToAccount({
      bankKey: null,
      notificationText: "some text",
      userAccounts: [defaultAccount],
      defaultAccountId: "acct-default" as AccountId,
    });
    expect(result).toEqual({ accountId: "acct-default", needsReview: true });
  });

  it("auto-links when bank has exactly 1 account", () => {
    const accounts = [defaultAccount, makeAccount("acct-nequi", "nequi", [])];
    const result = linkTransactionToAccount({
      bankKey: "nequi",
      notificationText: "",
      userAccounts: accounts,
      defaultAccountId: "acct-default" as AccountId,
    });
    expect(result).toEqual({ accountId: "acct-nequi", needsReview: false });
  });

  it("uses identifier to disambiguate when bank has 2+ accounts", () => {
    const accounts = [
      defaultAccount,
      makeAccount("acct-visa", "davibank", ["Visa Oro"]),
      makeAccount("acct-mc", "davibank", ["Mastercard"]),
    ];
    const result = linkTransactionToAccount({
      bankKey: "davibank",
      notificationText: "Compra con tarjeta Visa Oro en Exito por $50,000.",
      userAccounts: accounts,
      defaultAccountId: "acct-default" as AccountId,
    });
    expect(result).toEqual({ accountId: "acct-visa", needsReview: false });
  });

  it("queues for review when identifier extraction fails with multi-account", () => {
    const accounts = [
      defaultAccount,
      makeAccount("acct-1", "davibank", ["Visa Oro"]),
      makeAccount("acct-2", "davibank", ["Mastercard"]),
    ];
    const result = linkTransactionToAccount({
      bankKey: "davibank",
      notificationText: "Compra por $50,000 en Exito.",
      userAccounts: accounts,
      defaultAccountId: "acct-default" as AccountId,
    });
    expect(result).toEqual({ accountId: "acct-default", needsReview: true });
  });

  it("queues for review when bank has 0 matching accounts", () => {
    const result = linkTransactionToAccount({
      bankKey: "bancolombia",
      notificationText: "some text",
      userAccounts: [defaultAccount],
      defaultAccountId: "acct-default" as AccountId,
    });
    expect(result).toEqual({ accountId: "acct-default", needsReview: true });
  });
});
