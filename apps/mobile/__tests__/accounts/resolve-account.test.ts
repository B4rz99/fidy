import { describe, expect, it } from "vitest";
import { resolveAccountId } from "@/features/accounts/lib/resolve-account";
import type { StoredAccount } from "@/features/accounts/schema";
import type { AccountId } from "@/shared/types/branded";

const makeAccount = (
  id: string,
  identifiers: readonly string[]
): Pick<StoredAccount, "id" | "identifiers"> => ({
  id: id as AccountId,
  identifiers,
});

describe("resolveAccountId", () => {
  it("returns account when identifier matches exactly", () => {
    const candidates = [
      makeAccount("acct-1", ["Visa Oro"]),
      makeAccount("acct-2", ["Mastercard Black"]),
    ];
    expect(resolveAccountId(candidates, "Visa Oro")).toBe("acct-1");
  });

  it("matches case-insensitively", () => {
    const candidates = [makeAccount("acct-1", ["Visa Oro"])];
    expect(resolveAccountId(candidates, "visa oro")).toBe("acct-1");
  });

  it("matches last 4 digits", () => {
    const candidates = [makeAccount("acct-1", ["*4521"]), makeAccount("acct-2", ["*7890"])];
    expect(resolveAccountId(candidates, "*4521")).toBe("acct-1");
  });

  it("returns 'review' when no identifier provided", () => {
    const candidates = [makeAccount("acct-1", ["Visa Oro"]), makeAccount("acct-2", ["Mastercard"])];
    expect(resolveAccountId(candidates, null)).toBe("review");
  });

  it("returns 'review' when identifier matches nothing", () => {
    const candidates = [makeAccount("acct-1", ["Visa Oro"])];
    expect(resolveAccountId(candidates, "Mastercard")).toBe("review");
  });

  it("returns 'review' when identifier matches 2+ accounts", () => {
    const candidates = [makeAccount("acct-1", ["Visa Oro"]), makeAccount("acct-2", ["Visa Oro"])];
    expect(resolveAccountId(candidates, "Visa Oro")).toBe("review");
  });

  it("returns the only account when candidates length is 1", () => {
    const candidates = [makeAccount("acct-1", ["Visa Oro"])];
    expect(resolveAccountId(candidates, null)).toBe("acct-1");
  });
});
