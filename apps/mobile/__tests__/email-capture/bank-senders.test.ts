import { describe, expect, it } from "vitest";
import { DEFAULT_BANK_SENDERS, isBankSender } from "@/features/email-capture/lib/bank-senders";

describe("bank senders", () => {
  it("has default Colombian bank senders", () => {
    expect(DEFAULT_BANK_SENDERS.length).toBeGreaterThan(0);
    expect(DEFAULT_BANK_SENDERS).toContainEqual(
      expect.objectContaining({ email: "notificaciones@bancolombia.com.co" })
    );
  });

  it("isBankSender returns true for known senders", () => {
    expect(isBankSender("notificaciones@bancolombia.com.co", DEFAULT_BANK_SENDERS)).toBe(true);
  });

  it("isBankSender returns false for unknown senders", () => {
    expect(isBankSender("promo@random.com", DEFAULT_BANK_SENDERS)).toBe(false);
  });

  it("isBankSender is case-insensitive", () => {
    expect(isBankSender("Notificaciones@Bancolombia.com.co", DEFAULT_BANK_SENDERS)).toBe(true);
  });
});
