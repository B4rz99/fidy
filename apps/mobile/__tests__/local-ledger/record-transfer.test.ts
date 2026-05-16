import { describe, expect, it } from "vitest";
import {
  createRecordTransfer,
  type FinancialAccountId,
  type LocalLedgerTransferRepository,
  type LocalLedgerTransferSide,
  type RecordTransferCommand,
  type TransferId,
  type UserId,
} from "@/local-ledger/public";
import type { CopAmount, IsoDate, IsoDateTime } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const FROM_ACCOUNT_ID = "account-from" as FinancialAccountId;
const TO_ACCOUNT_ID = "account-to" as FinancialAccountId;
const TRANSFER_ID = "transfer-1" as TransferId;
const NOW = "2026-04-18T10:00:00.000Z" as IsoDateTime;
const TODAY = "2026-04-18" as IsoDate;

function makeCommand(overrides: Partial<RecordTransferCommand> = {}): RecordTransferCommand {
  return {
    transferId: TRANSFER_ID,
    amount: 250000 as CopAmount,
    fromSide: { kind: "account", accountId: FROM_ACCOUNT_ID },
    toSide: { kind: "account", accountId: TO_ACCOUNT_ID },
    description: "Move to savings",
    date: TODAY,
    now: NOW,
    source: "manual",
    ...overrides,
  };
}

function createHarness(usableAccountIds: readonly FinancialAccountId[]) {
  const savedTransfers: Parameters<LocalLedgerTransferRepository["record"]>[0][] = [];
  const recordTransfer = createRecordTransfer({
    transfers: {
      record: async (transfer) => {
        const accountSides = [transfer.fromSide, transfer.toSide].filter(isAccountSide);
        if (!accountSides.every((side) => usableAccountIds.includes(side.accountId))) {
          return { code: "account-not-usable" };
        }

        savedTransfers.push(transfer);
        return { code: "recorded", transfer };
      },
    },
    today: () => TODAY,
    userId: USER_ID,
  });

  return { recordTransfer, savedTransfers };
}

function isAccountSide(
  side: LocalLedgerTransferSide
): side is Extract<LocalLedgerTransferSide, { kind: "account" }> {
  return side.kind === "account";
}

describe("RecordTransfer", () => {
  it("records a transfer through the Local Ledger write boundary", async () => {
    const { recordTransfer, savedTransfers } = createHarness([FROM_ACCOUNT_ID, TO_ACCOUNT_ID]);

    const result = await recordTransfer(makeCommand());

    expect(result).toEqual({
      code: "recorded",
      transfer: {
        id: TRANSFER_ID,
        userId: USER_ID,
        amount: 250000,
        fromSide: { kind: "account", accountId: FROM_ACCOUNT_ID },
        toSide: { kind: "account", accountId: TO_ACCOUNT_ID },
        description: "Move to savings",
        date: TODAY,
        source: "manual",
        createdAt: NOW,
        updatedAt: NOW,
        voidedAt: null,
      },
      events: [
        {
          type: "local-ledger.transfer-recorded",
          transferId: TRANSFER_ID,
          userId: USER_ID,
          occurredAt: NOW,
        },
      ],
    });
    expect(savedTransfers).toEqual([result.code === "recorded" ? result.transfer : null]);
  });

  it("keeps transfer records separate from transaction-only attribution", async () => {
    const { recordTransfer } = createHarness([FROM_ACCOUNT_ID, TO_ACCOUNT_ID]);

    const result = await recordTransfer(makeCommand());

    expect(result.code).toBe("recorded");
    if (result.code !== "recorded") return;
    expect(result.transfer).not.toHaveProperty("categoryId");
    expect(result.transfer).not.toHaveProperty("category");
    expect(result.transfer).not.toHaveProperty("counterparty");
  });

  it.each([
    ["future-dated", { date: "2026-04-19" as IsoDate }],
    ["amount-not-positive", { amount: 0 as CopAmount }],
    ["amount-not-positive", { amount: -1 as CopAmount }],
    ["amount-not-positive", { amount: Number.NaN as CopAmount }],
    ["amount-not-positive", { amount: 10.5 as CopAmount }],
    ["from-side-required", { fromSide: null }],
    ["to-side-required", { toSide: null }],
    [
      "tracked-account-required",
      {
        fromSide: { kind: "external", label: "Brokerage" },
        toSide: { kind: "external", label: "Cash app" },
      },
    ],
    ["same-account", { toSide: { kind: "account", accountId: FROM_ACCOUNT_ID } }],
    ["external-label-required", { fromSide: { kind: "external", label: "   " } }],
    ["external-label-required", { toSide: { kind: "external", label: "" } }],
  ] as const)("rejects invalid transfers: %s", async (reason, overrides) => {
    const { recordTransfer, savedTransfers } = createHarness([FROM_ACCOUNT_ID, TO_ACCOUNT_ID]);

    const result = await recordTransfer(makeCommand(overrides));

    expect(result).toEqual({ code: "rejected", reason, events: [] });
    expect(savedTransfers).toEqual([]);
  });

  it("rejects tracked accounts that are not usable by the user", async () => {
    const { recordTransfer, savedTransfers } = createHarness([FROM_ACCOUNT_ID]);

    const result = await recordTransfer(makeCommand());

    expect(result).toEqual({ code: "rejected", reason: "account-not-usable", events: [] });
    expect(savedTransfers).toEqual([]);
  });
});
