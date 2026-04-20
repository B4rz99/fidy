import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/features/financial-accounts");
});

describe("getActivityAccountNames", () => {
  it("returns an empty map when the financial accounts table is not ready yet", async () => {
    vi.doMock("@/features/financial-accounts", () => ({
      getFinancialAccountsForUser: () => {
        throw new Error("SQLiteErrorException: Error code 1: no such table: financial_accounts");
      },
    }));

    const { getActivityAccountNames: loadAccountNames } = await import(
      "@/features/dashboard/lib/get-activity-account-names"
    );

    expect(loadAccountNames({} as never, USER_ID)).toEqual({});
  });

  it("maps account ids to names once the table is available", async () => {
    vi.doMock("@/features/financial-accounts", () => ({
      getFinancialAccountsForUser: () => [
        { id: "fa-1" as FinancialAccountId, name: "Checking" },
        { id: "fa-2" as FinancialAccountId, name: "Savings" },
      ],
    }));

    const { getActivityAccountNames: loadAccountNames } = await import(
      "@/features/dashboard/lib/get-activity-account-names"
    );

    expect(loadAccountNames({} as never, USER_ID)).toEqual({
      "fa-1": "Checking",
      "fa-2": "Savings",
    });
  });

  it("rethrows unexpected lookup errors", async () => {
    vi.doMock("@/features/financial-accounts", () => ({
      getFinancialAccountsForUser: () => {
        throw new Error("boom");
      },
    }));

    const { getActivityAccountNames: loadAccountNames } = await import(
      "@/features/dashboard/lib/get-activity-account-names"
    );

    expect(() => loadAccountNames({} as never, USER_ID)).toThrow("boom");
  });
});
