// biome-ignore-all lint/suspicious/noExplicitAny: boundary test uses a focused Drizzle double
import { describe, expect, it } from "vitest";
import { recordManualTransactionWithLocalLedger } from "@/infrastructure/local-ledger/record-transaction";
import type { CategoryId, FinancialAccountId, TransactionId, UserId } from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const ACCOUNT_ID = "fa-active" as FinancialAccountId;
const TRANSACTION_ID = "tx-manual" as TransactionId;
const NOW = new Date("2026-04-18T10:00:00.000Z");

function createDbDouble(accountLookupResults: readonly boolean[]) {
  const insertedTransactions: unknown[] = [];
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
          insertedTransactions.push(row);
        },
      }),
    }),
  };

  return { db, insertedTransactions, transactionCalls };
}

describe("manual transaction Local Ledger writer", () => {
  it("records a valid manual transaction through Local Ledger", async () => {
    const { db, insertedTransactions, transactionCalls } = createDbDouble([true, true]);

    const result = await recordManualTransactionWithLocalLedger({
      db: db as any,
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
      input: {
        type: "expense",
        digits: "$45.200",
        categoryId: "food" as CategoryId,
        accountId: ACCOUNT_ID,
        description: "  Groceries  ",
        date: NOW,
      },
      now: NOW,
    });

    expect(result).toEqual({
      success: true,
      transaction: {
        id: TRANSACTION_ID,
        userId: USER_ID,
        type: "expense",
        amount: 45200,
        accountId: ACCOUNT_ID,
        accountAttributionState: "confirmed",
        categoryId: "food",
        description: "Groceries",
        counterpartyName: null,
        date: "2026-04-18",
        createdAt: "2026-04-18T10:00:00.000Z",
        updatedAt: "2026-04-18T10:00:00.000Z",
        voidedAt: null,
        supersededAt: null,
        supersededByTransferId: null,
        source: "manual",
      },
    });
    expect(insertedTransactions).toHaveLength(1);
    expect(transactionCalls).toHaveLength(1);
  });

  it("rechecks account usability inside the commit transaction before inserting", async () => {
    const { db, insertedTransactions } = createDbDouble([true, false]);

    const result = await recordManualTransactionWithLocalLedger({
      db: db as any,
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
      input: {
        type: "expense",
        digits: "45200",
        categoryId: "food" as CategoryId,
        accountId: ACCOUNT_ID,
        description: "Groceries",
        date: NOW,
      },
      now: NOW,
    });

    expect(result).toEqual({ success: false, error: "accountNotUsable" });
    expect(insertedTransactions).toEqual([]);
  });

  it("rejects missing category instead of silently defaulting to other", async () => {
    const { db, insertedTransactions } = createDbDouble([true]);

    const result = await recordManualTransactionWithLocalLedger({
      db: db as any,
      userId: USER_ID,
      transactionId: TRANSACTION_ID,
      input: {
        type: "expense",
        digits: "45200",
        categoryId: null,
        accountId: ACCOUNT_ID,
        description: "Groceries",
        date: NOW,
      },
      now: NOW,
    });

    expect(result).toEqual({ success: false, error: "missingCategory" });
    expect(insertedTransactions).toEqual([]);
  });
});
