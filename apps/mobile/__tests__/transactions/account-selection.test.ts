import { describe, expect, it } from "vitest";
import { hasSelectedFinancialAccount } from "@/features/transactions/lib/account-selection";
import { requireIsoDateTime, requireUserId } from "@/shared/types/assertions";
import type { FinancialAccountId } from "@/shared/types/branded";

const USER_ID = requireUserId("user-1");

const ACCOUNTS = [
  {
    id: "fa-default-user-1" as FinancialAccountId,
    userId: USER_ID,
    name: "Cash",
    kind: "cash" as const,
    isDefault: true,
    createdAt: requireIsoDateTime("2026-04-18T10:00:00.000Z"),
    updatedAt: requireIsoDateTime("2026-04-18T10:00:00.000Z"),
    deletedAt: null,
  },
  {
    id: "fa-bank-1" as FinancialAccountId,
    userId: USER_ID,
    name: "Bancolombia",
    kind: "checking" as const,
    isDefault: false,
    createdAt: requireIsoDateTime("2026-04-18T10:00:00.000Z"),
    updatedAt: requireIsoDateTime("2026-04-18T10:00:00.000Z"),
    deletedAt: null,
  },
] as const;

describe("hasSelectedFinancialAccount", () => {
  it("returns true when the selected account exists in the available list", () => {
    expect(hasSelectedFinancialAccount(ACCOUNTS, "fa-default-user-1" as FinancialAccountId)).toBe(
      true
    );
  });

  it("returns false when the selected account is missing from the available list", () => {
    expect(hasSelectedFinancialAccount(ACCOUNTS, "fa-missing" as FinancialAccountId)).toBe(false);
  });

  it("returns false when no account is selected", () => {
    expect(hasSelectedFinancialAccount(ACCOUNTS, null)).toBe(false);
  });
});
