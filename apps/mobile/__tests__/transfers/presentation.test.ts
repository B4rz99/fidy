import { describe, expect, it } from "vitest";
import { OUTSIDE_FIDY_LABEL, type StoredTransfer } from "@/features/transfers/lib/build-transfer";
import {
  getTransferActivityCopy,
  getTransferSideLabel,
  isTransferSideSelected,
} from "@/features/transfers/lib/presentation";
import type { TranslateFn } from "@/shared/i18n";
import type { CopAmount, FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const CHECKING_ID = "fa-checking" as FinancialAccountId;
const CARD_ID = "fa-card" as FinancialAccountId;
const t: TranslateFn = (key, params) =>
  params
    ? `${key}:${Object.entries(params)
        .map(([paramKey, value]) => `${paramKey}=${value}`)
        .join(",")}`
    : key;

function makeTransfer(overrides: Partial<StoredTransfer> = {}): StoredTransfer {
  return {
    id: "tr-1" as TransferId,
    userId: USER_ID,
    amount: 450_000 as CopAmount,
    fromSide: { kind: "account", accountId: CHECKING_ID },
    toSide: { kind: "account", accountId: CARD_ID },
    description: "",
    date: new Date("2026-04-19T00:00:00.000Z"),
    createdAt: new Date("2026-04-19T09:00:00.000Z"),
    updatedAt: new Date("2026-04-19T10:00:00.000Z"),
    deletedAt: null,
    source: "manual",
    ...overrides,
  };
}

describe("transfer presentation", () => {
  it("uses account names when the side is tracked and falls back to unknown", () => {
    expect(
      getTransferSideLabel(
        { kind: "account", accountId: CHECKING_ID },
        { [CHECKING_ID]: "Checking" },
        t
      )
    ).toBe("Checking");
    expect(getTransferSideLabel({ kind: "account", accountId: CARD_ID }, {}, t)).toBe(
      "common.unknown"
    );
  });

  it("localizes Outside Fidy and preserves custom external labels", () => {
    expect(getTransferSideLabel({ kind: "external", label: OUTSIDE_FIDY_LABEL }, {}, t)).toBe(
      "transfers.outsideFidy"
    );
    expect(getTransferSideLabel({ kind: "external", label: "Wallet in mom's house" }, {}, t)).toBe(
      "Wallet in mom's house"
    );
  });

  it("builds activity copy for inbound account transfers", () => {
    const copy = getTransferActivityCopy(
      makeTransfer({
        fromSide: { kind: "external", label: OUTSIDE_FIDY_LABEL },
        toSide: { kind: "account", accountId: CHECKING_ID },
      }),
      { [CHECKING_ID]: "Checking" },
      t
    );

    expect(copy).toEqual({
      title: "transfers.activity.toAccount:name=Checking",
      route: "transfers.activity.route:from=transfers.outsideFidy,to=Checking",
    });
  });

  it("builds activity copy for outbound account transfers and generic external transfers", () => {
    const outbound = getTransferActivityCopy(
      makeTransfer({
        fromSide: { kind: "account", accountId: CHECKING_ID },
        toSide: { kind: "external", label: OUTSIDE_FIDY_LABEL },
      }),
      { [CHECKING_ID]: "Checking" },
      t
    );
    const generic = getTransferActivityCopy(
      makeTransfer({
        fromSide: { kind: "external", label: "Cash stash" },
        toSide: { kind: "external", label: "Wallet in mom's house" },
      }),
      {},
      t
    );

    expect(outbound).toEqual({
      title: "transfers.activity.fromAccount:name=Checking",
      route: "transfers.activity.route:from=Checking,to=transfers.outsideFidy",
    });
    expect(generic).toEqual({
      title: "transfers.activity.generic",
      route: "transfers.activity.route:from=Cash stash,to=Wallet in mom's house",
    });
  });

  it("marks only the selected tracked side as selected", () => {
    expect(isTransferSideSelected({ kind: "account", accountId: CHECKING_ID }, CHECKING_ID)).toBe(
      true
    );
    expect(
      isTransferSideSelected({ kind: "external", label: OUTSIDE_FIDY_LABEL }, CHECKING_ID)
    ).toBe(false);
    expect(isTransferSideSelected(null, CHECKING_ID)).toBe(false);
  });
});
