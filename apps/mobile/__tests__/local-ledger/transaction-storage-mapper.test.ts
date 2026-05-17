import { describe, expect, test } from "vitest";
import {
  normalizeTransactionStorageRow,
  toTransactionStorageRow,
} from "@/infrastructure/local-ledger/transaction-storage";
import type { LocalLedgerEntryId, RecordTransactionAccepted } from "@/local-ledger/public";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const acceptedTransaction: RecordTransactionAccepted = {
  id: "transaction-1" as LocalLedgerEntryId,
  userId: "user-1" as UserId,
  type: "expense",
  amount: 12_000 as CopAmount,
  accountId: "account-1" as FinancialAccountId,
  accountAttributionState: "confirmed",
  categoryId: "food" as CategoryId,
  occurredOn: "2026-05-11" as IsoDate,
  description: "User note",
  counterpartyName: "Cafe",
  source: "email_capture",
};

describe("Local Ledger transaction storage mapping", () => {
  test("stores accepted transaction domain fields in the SQLite row shape", () => {
    const row = toTransactionStorageRow({
      transaction: acceptedTransaction,
      now: "2026-05-11T12:00:00.000Z" as IsoDateTime,
    });

    expect(row).toEqual({
      id: "transaction-1",
      userId: "user-1",
      type: "expense",
      amount: 12_000,
      accountId: "account-1",
      accountAttributionState: "confirmed",
      categoryId: "food",
      description: "User note",
      counterpartyName: "Cafe",
      date: "2026-05-11",
      createdAt: "2026-05-11T12:00:00.000Z",
      updatedAt: "2026-05-11T12:00:00.000Z",
      voidedAt: null,
      supersededAt: null,
      supersededByTransferId: null,
      source: "email_capture",
    });
  });

  test("rejects provider identifiers at the infrastructure boundary", () => {
    expect(() =>
      normalizeTransactionStorageRow({
        id: "transaction-2" as TransactionId,
        userId: "user-1" as UserId,
        type: "expense",
        amount: 42_000 as CopAmount,
        categoryId: "transport" as CategoryId,
        description: "Cab",
        date: "2026-05-12" as IsoDate,
        source: "email_gmail",
        createdAt: "2026-05-12T12:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-05-12T12:00:00.000Z" as IsoDateTime,
      })
    ).toThrow("Unsupported transaction source: email_gmail");
  });

  test("fills defaults for current transaction write rows through the infrastructure boundary", () => {
    const row = normalizeTransactionStorageRow({
      id: "transaction-2" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 42_000 as CopAmount,
      categoryId: "transport" as CategoryId,
      description: "Cab",
      date: "2026-05-12" as IsoDate,
      source: "email_capture",
      createdAt: "2026-05-12T12:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-05-12T12:00:00.000Z" as IsoDateTime,
    });

    expect(row).toMatchObject({
      id: "transaction-2",
      accountId: "fa-default-user-1",
      accountAttributionState: "unresolved",
      counterpartyName: null,
      supersededAt: null,
      supersededByTransferId: null,
      source: "email_capture",
    });
  });
});
