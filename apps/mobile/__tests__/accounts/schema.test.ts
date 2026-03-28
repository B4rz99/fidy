import { describe, expect, it } from "vitest";
import { accountTypeSchema, bankKeySchema, createAccountSchema } from "@/features/accounts/schema";

describe("accountTypeSchema", () => {
  it("accepts valid types", () => {
    expect(accountTypeSchema.parse("debit")).toBe("debit");
    expect(accountTypeSchema.parse("credit")).toBe("credit");
    expect(accountTypeSchema.parse("wallet")).toBe("wallet");
  });

  it("rejects invalid type", () => {
    expect(() => accountTypeSchema.parse("savings")).toThrow();
  });
});

describe("bankKeySchema", () => {
  it("accepts known bank keys", () => {
    expect(bankKeySchema.parse("davibank")).toBe("davibank");
    expect(bankKeySchema.parse("nequi")).toBe("nequi");
    expect(bankKeySchema.parse("rappicard")).toBe("rappicard");
    expect(bankKeySchema.parse("other")).toBe("other");
  });

  it("rejects unknown bank key", () => {
    expect(() => bankKeySchema.parse("unknown_bank")).toThrow();
  });
});

describe("createAccountSchema", () => {
  it("validates a complete account input", () => {
    const result = createAccountSchema.safeParse({
      name: "Visa Oro",
      type: "debit",
      bankKey: "davibank",
      identifiers: ["Visa Oro"],
      initialBalance: 2500000,
    });
    expect(result.success).toBe(true);
  });

  it("defaults identifiers to empty array", () => {
    const result = createAccountSchema.parse({
      name: "Nequi",
      type: "wallet",
      bankKey: "nequi",
      initialBalance: 500000,
    });
    expect(result.identifiers).toEqual([]);
  });

  it("rejects empty name", () => {
    const result = createAccountSchema.safeParse({
      name: "",
      type: "debit",
      bankKey: "davibank",
      initialBalance: 0,
    });
    expect(result.success).toBe(false);
  });
});
