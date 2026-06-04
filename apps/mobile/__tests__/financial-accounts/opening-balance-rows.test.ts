import { describe, expect, it } from "vitest";
import {
  buildCreateOpeningBalanceRow,
  buildUpdatedOpeningBalance,
} from "@/features/financial-accounts/lib/management-service/opening-balance-rows";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  OpeningBalanceId,
  UserId,
} from "@/shared/types/branded";

const baseInput = {
  createOpeningBalanceId: () => "ob-new" as OpeningBalanceId,
  userId: "user-1" as UserId,
  accountId: "fa-1" as FinancialAccountId,
  openingBalance: {
    amount: 500000 as CopAmount,
    effectiveDate: "2026-04-01" as IsoDate,
  },
};

describe("opening balance row builders", () => {
  it("returns null when there is no opening balance to create", () => {
    expect(
      buildCreateOpeningBalanceRow({
        ...baseInput,
        openingBalance: null,
        createdAt: "now" as IsoDateTime,
      })
    ).toBeNull();
  });

  it("builds a new active opening balance row", () => {
    expect(
      buildUpdatedOpeningBalance({
        ...baseInput,
        existingOpeningBalance: null,
        updatedAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
      })
    ).toEqual({
      id: "ob-new",
      userId: "user-1",
      accountId: "fa-1",
      amount: 500000,
      effectiveDate: "2026-04-01",
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T10:00:00.000Z",
      deletedAt: null,
    });
  });

  it("preserves the existing id and createdAt when updating an active opening balance", () => {
    expect(
      buildUpdatedOpeningBalance({
        ...baseInput,
        existingOpeningBalance: {
          id: "ob-existing" as OpeningBalanceId,
          userId: "user-1" as UserId,
          accountId: "fa-1" as FinancialAccountId,
          amount: 100000 as CopAmount,
          effectiveDate: "2026-03-01" as IsoDate,
          createdAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
          updatedAt: "2026-03-02T10:00:00.000Z" as IsoDateTime,
          deletedAt: null,
        },
        updatedAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
      })
    ).toMatchObject({
      id: "ob-existing",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-04-19T10:00:00.000Z",
      amount: 500000,
    });
  });
});
