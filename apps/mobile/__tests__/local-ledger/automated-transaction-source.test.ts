// biome-ignore-all lint/suspicious/noExplicitAny: boundary test uses a focused Drizzle double
import { describe, expect, it } from "vitest";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/record-transaction";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;
const ACCOUNT_ID = "account-1" as FinancialAccountId;
const CATEGORY_ID = "food" as CategoryId;
const NOW = "2026-05-12T12:00:00.000Z" as IsoDateTime;

function createDbDouble() {
  const insertedRows: unknown[] = [];
  const db = {
    transaction: (callback: (tx: unknown) => unknown) => callback(db),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            all: () => [{ id: "usable" }],
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (row: unknown) => ({
        run: () => {
          insertedRows.push(row);
        },
      }),
    }),
  };

  return { db, insertedRows };
}

describe("automated transaction Local Ledger writer", () => {
  it("preserves the caller's closed automated source category", async () => {
    const { db, insertedRows } = createDbDouble();

    const result = await recordAutomatedTransactionWithLocalLedger({
      db: db as any,
      transactionId: "tx-email-1" as TransactionId,
      now: NOW,
      command: {
        userId: USER_ID,
        type: "expense",
        amount: 25_000 as CopAmount,
        accountId: ACCOUNT_ID,
        accountAttributionState: "unresolved",
        categoryId: CATEGORY_ID,
        occurredOn: "2026-05-12" as IsoDate,
        description: "Cafe",
        counterpartyName: "Cafe",
        source: "email_capture",
      },
    });

    expect(result.success).toBe(true);
    expect(insertedRows).toEqual([
      expect.objectContaining({
        id: "tx-email-1",
        source: "email_capture",
        accountAttributionState: "unresolved",
      }),
    ]);
  });
});
