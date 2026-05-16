import { describe, expect, it } from "vitest";
import {
  createRecordTransfer,
  createReclassifyTransactionsAsTransfer,
  type FinancialAccountId,
  type LocalLedgerTransferRepository,
  type LocalLedgerTransferSide,
  type ReclassifiableTransaction,
  type RecordTransferCommand,
  type TransferId,
  type UserId,
} from "@/local-ledger/public";
import type { CopAmount, IsoDate, IsoDateTime, TransactionId } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const FROM_ACCOUNT_ID = "account-from" as FinancialAccountId;
const TO_ACCOUNT_ID = "account-to" as FinancialAccountId;
const TRANSFER_ID = "transfer-1" as TransferId;
const OUTGOING_TRANSACTION_ID = "transaction-out" as TransactionId;
const INCOMING_TRANSACTION_ID = "transaction-in" as TransactionId;
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

function makeReclassifiableTransaction(
  overrides: Partial<ReclassifiableTransaction> = {}
): ReclassifiableTransaction {
  return {
    id: OUTGOING_TRANSACTION_ID,
    userId: USER_ID,
    type: "expense",
    amount: 250000 as CopAmount,
    accountId: FROM_ACCOUNT_ID,
    accountAttributionState: "confirmed",
    date: TODAY,
    voidedAt: null,
    supersededAt: null,
    ...overrides,
  };
}

function createReclassificationHarness(
  overrides: {
    readonly outgoing?: Partial<ReclassifiableTransaction> | null;
    readonly incoming?: Partial<ReclassifiableTransaction> | null;
    readonly commit?: "committed" | "rejected";
  } = {}
) {
  const commits: unknown[] = [];
  const transactions = new Map<TransactionId, ReclassifiableTransaction>();
  if (overrides.outgoing !== null) {
    transactions.set(
      OUTGOING_TRANSACTION_ID,
      makeReclassifiableTransaction(overrides.outgoing ?? {})
    );
  }
  if (overrides.incoming !== null) {
    transactions.set(
      INCOMING_TRANSACTION_ID,
      makeReclassifiableTransaction({
        id: INCOMING_TRANSACTION_ID,
        type: "income",
        accountId: TO_ACCOUNT_ID,
        ...overrides.incoming,
      })
    );
  }

  const reclassifyTransactionsAsTransfer = createReclassifyTransactionsAsTransfer({
    userId: USER_ID,
    source: "capture-match",
    now: () => NOW,
    generateTransferId: () => TRANSFER_ID,
    ports: {
      loadTransaction: async (transactionId) => transactions.get(transactionId) ?? null,
      commitReclassification: async (input) => {
        commits.push(input);
        return overrides.commit === "rejected"
          ? { code: "rejected", reason: "transactions-not-reclassifiable" }
          : { code: "committed", transfer: input.transfer };
      },
    },
  });

  return { commits, reclassifyTransactionsAsTransfer };
}

it("reclassifies a matching expense and income pair through Local Ledger ports", async () => {
  const { commits, reclassifyTransactionsAsTransfer } = createReclassificationHarness();

  const result = await reclassifyTransactionsAsTransfer({
    outgoingTransactionId: OUTGOING_TRANSACTION_ID,
    incomingTransactionId: INCOMING_TRANSACTION_ID,
    description: " Move to savings ",
  });

  expect(result).toEqual({
    code: "reclassified",
    transfer: {
      id: TRANSFER_ID,
      userId: USER_ID,
      amount: 250000,
      fromSide: { kind: "account", accountId: FROM_ACCOUNT_ID },
      toSide: { kind: "account", accountId: TO_ACCOUNT_ID },
      description: "Move to savings",
      date: TODAY,
      source: "capture-match",
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
  expect(commits).toEqual([
    expect.objectContaining({
      outgoingTransactionId: OUTGOING_TRANSACTION_ID,
      incomingTransactionId: INCOMING_TRANSACTION_ID,
      supersededAt: NOW,
    }),
  ]);
});

it.each([
  ["missing outgoing", { outgoing: null }, "transactions-not-found"],
  ["other user", { incoming: { userId: "other-user" as UserId } }, "transactions-not-found"],
  ["voided transaction", { outgoing: { voidedAt: NOW } }, "transactions-not-found"],
  ["superseded transaction", { incoming: { supersededAt: NOW } }, "transactions-not-found"],
  [
    "same transaction id",
    { incoming: { id: OUTGOING_TRANSACTION_ID } },
    "transactions-not-reclassifiable",
  ],
  [
    "wrong outgoing type",
    { outgoing: { type: "income" as const } },
    "transactions-not-reclassifiable",
  ],
  [
    "wrong incoming type",
    { incoming: { type: "expense" as const } },
    "transactions-not-reclassifiable",
  ],
  [
    "amount mismatch",
    { incoming: { amount: 100000 as CopAmount } },
    "transactions-not-reclassifiable",
  ],
  [
    "non-positive amount",
    { outgoing: { amount: 0 as CopAmount }, incoming: { amount: 0 as CopAmount } },
    "transactions-not-reclassifiable",
  ],
  [
    "date mismatch",
    { incoming: { date: "2026-04-19" as IsoDate } },
    "transactions-not-reclassifiable",
  ],
  [
    "unresolved attribution",
    { incoming: { accountAttributionState: "unresolved" as const } },
    "transactions-not-reclassifiable",
  ],
  ["missing account", { outgoing: { accountId: null } }, "transactions-not-reclassifiable"],
  ["same account", { incoming: { accountId: FROM_ACCOUNT_ID } }, "transactions-not-reclassifiable"],
] as const)("rejects %s before commit", async (_label, overrides, reason) => {
  const { commits, reclassifyTransactionsAsTransfer } = createReclassificationHarness(overrides);

  const result = await reclassifyTransactionsAsTransfer({
    outgoingTransactionId: OUTGOING_TRANSACTION_ID,
    incomingTransactionId: INCOMING_TRANSACTION_ID,
    description: "Move to savings",
  });

  expect(result).toEqual({ code: "rejected", reason, events: [] });
  expect(commits).toEqual([]);
});

it("returns a rejection when the commit port rejects the current rows", async () => {
  const { commits, reclassifyTransactionsAsTransfer } = createReclassificationHarness({
    commit: "rejected",
  });

  const result = await reclassifyTransactionsAsTransfer({
    outgoingTransactionId: OUTGOING_TRANSACTION_ID,
    incomingTransactionId: INCOMING_TRANSACTION_ID,
    description: "Move to savings",
  });

  expect(result).toEqual({
    code: "rejected",
    reason: "transactions-not-reclassifiable",
    events: [],
  });
  expect(commits).toHaveLength(1);
});
