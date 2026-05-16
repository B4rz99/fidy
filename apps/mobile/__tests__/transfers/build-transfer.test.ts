import { describe, expect, test } from "vitest";
import {
  buildTransfer,
  OUTSIDE_FIDY_LABEL,
  toStoredTransfer,
  toTransferRow,
} from "@/features/transfers/lib/build-transfer";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransferId,
  UserId,
} from "@/shared/types/branded";

const NOW = new Date("2026-04-19T10:00:00.000Z");

const validInput = {
  digits: "450000",
  fromSide: { kind: "account" as const, accountId: "fa-checking" as FinancialAccountId },
  toSide: { kind: "account" as const, accountId: "fa-credit-card" as FinancialAccountId },
  description: "Visa payment",
  date: new Date("2026-04-19T00:00:00.000Z"),
};

describe("buildTransfer", () => {
  test("builds a tracked-account transfer with one amount and two explicit sides", () => {
    const result = buildTransfer({
      input: validInput,
      userId: "user-1" as UserId,
      id: "tr-1" as TransferId,
      now: NOW,
      source: "manual",
    });

    expect(result).toMatchObject({
      success: true,
      transfer: expect.objectContaining({
        id: "tr-1",
        userId: "user-1",
        amount: 450000,
        fromSide: validInput.fromSide,
        toSide: validInput.toSide,
        description: "Visa payment",
      }),
    });
  });

  test("rejects transfers that do not have two explicit sides", () => {
    const missingFrom = buildTransfer({
      input: { ...validInput, fromSide: null },
      userId: "user-1" as UserId,
      id: "tr-2" as TransferId,
      now: NOW,
      source: "manual",
    });
    const missingTo = buildTransfer({
      input: { ...validInput, toSide: null },
      userId: "user-1" as UserId,
      id: "tr-3" as TransferId,
      now: NOW,
      source: "manual",
    });

    expect(missingFrom).toEqual({ success: false, error: "fromSideRequired" });
    expect(missingTo).toEqual({ success: false, error: "toSideRequired" });
  });

  test("allows the generic outside side only when the other side is a tracked account", () => {
    const trackedToOutside = buildTransfer({
      input: {
        ...validInput,
        toSide: { kind: "external" as const, label: OUTSIDE_FIDY_LABEL },
      },
      userId: "user-1" as UserId,
      id: "tr-4" as TransferId,
      now: NOW,
      source: "manual",
    });
    const outsideToOutside = buildTransfer({
      input: {
        ...validInput,
        fromSide: { kind: "external" as const, label: OUTSIDE_FIDY_LABEL },
        toSide: { kind: "external" as const, label: OUTSIDE_FIDY_LABEL },
      },
      userId: "user-1" as UserId,
      id: "tr-5" as TransferId,
      now: NOW,
      source: "manual",
    });

    expect(trackedToOutside).toMatchObject({
      success: true,
      transfer: expect.objectContaining({
        toSide: { kind: "external", label: OUTSIDE_FIDY_LABEL },
      }),
    });
    expect(outsideToOutside).toEqual({ success: false, error: "trackedAccountRequired" });
  });

  test("rejects transfers where both tracked sides point to the same account", () => {
    const result = buildTransfer({
      input: {
        ...validInput,
        toSide: { kind: "account" as const, accountId: "fa-checking" as FinancialAccountId },
      },
      userId: "user-1" as UserId,
      id: "tr-6" as TransferId,
      now: NOW,
      source: "manual",
    });

    expect(result).toEqual({ success: false, error: "distinctSidesRequired" });
  });
});

describe("toStoredTransfer / toTransferRow round-trip", () => {
  test("serializes and hydrates explicit outside sides without losing the label", () => {
    const storedTransfer = {
      id: "tr-7" as TransferId,
      userId: "user-1" as UserId,
      amount: 120000 as CopAmount,
      fromSide: { kind: "account" as const, accountId: "fa-wallet" as FinancialAccountId },
      toSide: { kind: "external" as const, label: OUTSIDE_FIDY_LABEL },
      description: "",
      date: new Date("2026-04-19T00:00:00.000Z"),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      source: "manual" as const,
    };

    const row = toTransferRow(storedTransfer);
    const roundTrip = toStoredTransfer({
      ...row,
      date: "2026-04-19" as IsoDate,
      createdAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
    });

    expect(row.fromAccountId).toBe("fa-wallet");
    expect(row.toExternalLabel).toBe(OUTSIDE_FIDY_LABEL);
    expect(roundTrip.toSide).toEqual({ kind: "external", label: OUTSIDE_FIDY_LABEL });
  });
});
