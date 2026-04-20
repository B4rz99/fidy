import { describe, expect, it } from "vitest";
import { getActivityAccountNames } from "@/features/dashboard/lib/get-activity-account-names";
import type { FinancialAccountId, UserId } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;

function createAccountLookupDb(rows: readonly { id: FinancialAccountId; name: string }[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            all: () => rows,
          }),
        }),
      }),
    }),
  };
}

describe("getActivityAccountNames", () => {
  it("returns an empty map when the financial accounts table is not ready yet", () => {
    const db = {
      select: () => {
        throw new Error("SQLiteErrorException: Error code 1: no such table: financial_accounts");
      },
    };

    expect(getActivityAccountNames(db as never, USER_ID)).toEqual({});
  });

  it("maps account ids to names once the table is available", () => {
    const db = createAccountLookupDb([
      { id: "fa-1" as FinancialAccountId, name: "Checking" },
      { id: "fa-2" as FinancialAccountId, name: "Savings" },
    ]);

    expect(getActivityAccountNames(db as never, USER_ID)).toEqual({
      "fa-1": "Checking",
      "fa-2": "Savings",
    });
  });

  it("rethrows unexpected lookup errors", () => {
    const db = {
      select: () => {
        throw new Error("boom");
      },
    };

    expect(() => getActivityAccountNames(db as never, USER_ID)).toThrow("boom");
  });
});
