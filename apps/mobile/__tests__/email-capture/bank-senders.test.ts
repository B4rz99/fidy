import { describe, expect, it } from "vitest";
import { DEFAULT_BANK_SENDERS, isBankSender } from "@/features/email-capture/lib/bank-senders";

describe("bank senders", () => {
  it("has default verified bank senders", () => {
    expect(DEFAULT_BANK_SENDERS.length).toBeGreaterThan(0);
    expect(DEFAULT_BANK_SENDERS).toContainEqual(
      expect.objectContaining({ email: "davibankinforma@davibank.com" })
    );
  });

  it("isBankSender returns true for known senders", () => {
    expect(isBankSender("davibankinforma@davibank.com", DEFAULT_BANK_SENDERS)).toBe(true);
  });

  it("isBankSender returns false for unknown senders", () => {
    expect(isBankSender("promo@random.com", DEFAULT_BANK_SENDERS)).toBe(false);
  });

  it("isBankSender is case-insensitive", () => {
    expect(isBankSender("BBVA@BBVANET.COM.CO", DEFAULT_BANK_SENDERS)).toBe(true);
  });
});
