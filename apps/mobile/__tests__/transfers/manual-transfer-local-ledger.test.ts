// biome-ignore-all lint/suspicious/noExplicitAny: boundary test uses a focused Drizzle double
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitTransferForm } from "@/features/transfers/components/transfer-form/saveTransferForm";
import { recordManualTransferWithLocalLedger } from "@/infrastructure/local-ledger/record-transfer";
import type { FinancialAccountId, TransferId, UserId } from "@/shared/types/branded";

const { refreshTransactionsMock } = vi.hoisted(() => ({
  refreshTransactionsMock: vi.fn<(...args: any[]) => any>(),
}));

vi.mock("@/features/transactions/store.public", () => ({
  refreshTransactions: refreshTransactionsMock,
}));

const USER_ID = "user-1" as UserId;
const NOW = new Date("2026-04-18T10:00:00.000Z");
const ACTIVE_ACCOUNT_ID = "fa-active" as FinancialAccountId;
const CLOSED_ACCOUNT_ID = "fa-closed" as FinancialAccountId;

function createDbDouble(accountLookupResults: readonly boolean[]) {
  const insertedTransfers: unknown[] = [];
  const lookups = [...accountLookupResults];
  const transactionCalls: unknown[] = [];
  const db = {
    transaction: (callback: (tx: unknown) => unknown) => {
      transactionCalls.push(callback);
      return callback(db);
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            all: () => (lookups.shift() ? [{ id: "usable-account" }] : []),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (row: unknown) => ({
        run: () => {
          insertedTransfers.push(row);
        },
      }),
    }),
  };

  return { db, insertedTransfers, transactionCalls };
}

beforeEach(() => {
  refreshTransactionsMock.mockReset();
});

describe("manual transfer Local Ledger writer", () => {
  it("records a valid manual transfer through Local Ledger and inserts the transfer row", async () => {
    const { db, insertedTransfers, transactionCalls } = createDbDouble([true]);

    const result = await recordManualTransferWithLocalLedger({
      db: db as any,
      userId: USER_ID,
      transferId: "tr-valid" as TransferId,
      input: {
        digits: "$450.000",
        fromSide: { kind: "account", accountId: ACTIVE_ACCOUNT_ID },
        toSide: { kind: "external", label: "Outside Fidy" },
        description: "  Visa payment  ",
        date: NOW,
      },
      now: NOW,
    });

    expect(result).toEqual({
      success: true,
      transfer: {
        id: "tr-valid",
        userId: USER_ID,
        amount: 450000,
        fromSide: { kind: "account", accountId: ACTIVE_ACCOUNT_ID },
        toSide: { kind: "external", label: "Outside Fidy" },
        description: "Visa payment",
        date: "2026-04-18",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      },
    });
    expect(insertedTransfers).toEqual([
      {
        id: "tr-valid",
        userId: USER_ID,
        amount: 450000,
        fromAccountId: ACTIVE_ACCOUNT_ID,
        toAccountId: null,
        fromExternalLabel: null,
        toExternalLabel: "Outside Fidy",
        description: "Visa payment",
        date: "2026-04-18",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        deletedAt: null,
      },
    ]);
    expect(transactionCalls).toHaveLength(1);
  });

  it("rejects Local Ledger account usability failures before inserting a transfer", async () => {
    const { db, insertedTransfers } = createDbDouble([true, false]);

    const result = await recordManualTransferWithLocalLedger({
      db: db as any,
      userId: USER_ID,
      transferId: "tr-closed-account" as TransferId,
      input: {
        digits: "450000",
        fromSide: { kind: "account", accountId: ACTIVE_ACCOUNT_ID },
        toSide: { kind: "account", accountId: CLOSED_ACCOUNT_ID },
        description: "Move to closed savings",
        date: NOW,
      },
      now: NOW,
    });

    expect(result).toEqual({ success: false, error: "accountNotUsable" });
    expect(insertedTransfers).toEqual([]);
  });

  it("enforces Local Ledger validation through the full manual transfer form save path", async () => {
    const { db, insertedTransfers } = createDbDouble([true]);

    const result = await submitTransferForm({
      date: new Date("2099-04-19T00:00:00.000Z"),
      description: "Future transfer",
      db: db as any,
      digits: "450000",
      fromSide: { kind: "account", accountId: ACTIVE_ACCOUNT_ID },
      processedEmailId: null,
      sourceTransaction: null,
      toSide: { kind: "external", label: "Outside Fidy" },
      userId: USER_ID,
    });

    expect(result).toEqual({ success: false, error: "futureDated" });
    expect(insertedTransfers).toEqual([]);
    expect(refreshTransactionsMock).not.toHaveBeenCalled();
  });
});
