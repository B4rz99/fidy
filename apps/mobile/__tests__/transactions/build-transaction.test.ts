import { describe, expect, test } from "vitest";
import {
  buildTransaction,
  toStoredTransaction,
  toTransactionRow,
} from "@/features/transactions/lib/build-transaction";
import type { StoredTransaction } from "@/features/transactions/schema";
import type {
  CategoryId,
  CopAmount,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const NOW = new Date(2026, 2, 5, 12, 0, 0);

describe("buildTransaction", () => {
  const validInput = {
    type: "expense" as const,
    digits: "1234",
    categoryId: "food" as CategoryId,
    description: "Lunch",
    date: new Date(2026, 2, 5),
  };

  test("returns success with valid input", () => {
    const result = buildTransaction(validInput, "user-1" as UserId, "tx-1" as TransactionId, NOW);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.transaction.id).toBe("tx-1");
    expect(result.transaction.userId).toBe("user-1");
    expect(result.transaction.amount).toBe(1234);
    expect(result.transaction.categoryId).toBe("food");
    expect(result.transaction.createdAt).toBe(NOW);
    expect(result.transaction.updatedAt).toBe(NOW);
    expect(result.transaction.deletedAt).toBeNull();
  });

  test("returns error for zero amount", () => {
    const result = buildTransaction(
      { ...validInput, digits: "0" },
      "user-1" as UserId,
      "tx-2" as TransactionId,
      NOW
    );
    expect(result.success).toBe(false);
  });

  test("defaults categoryId to 'other' when null", () => {
    const result = buildTransaction(
      { ...validInput, categoryId: null },
      "user-1" as UserId,
      "tx-3" as TransactionId,
      NOW
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.transaction.categoryId).toBe("other");
  });

  test("returns error for non-numeric digits", () => {
    const result = buildTransaction(
      { ...validInput, digits: "abc" },
      "user-1" as UserId,
      "tx-4" as TransactionId,
      NOW
    );
    expect(result.success).toBe(false);
  });
});

describe("toStoredTransaction branch coverage", () => {
  test("handles null description by defaulting to empty string", () => {
    const row = {
      id: "tx-nd" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 500 as CopAmount,
      categoryId: "food" as CategoryId,
      description: null,
      date: "2026-03-01" as IsoDate,
      createdAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    };
    const result = toStoredTransaction(row);
    expect(result.description).toBe("");
  });

  test("handles non-null deletedAt by converting to Date", () => {
    const row = {
      id: "tx-da" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 500 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Test",
      date: "2026-03-01" as IsoDate,
      createdAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      deletedAt: "2026-03-02T10:00:00.000Z" as IsoDateTime,
    };
    const result = toStoredTransaction(row);
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.deletedAt?.toISOString()).toBe("2026-03-02T10:00:00.000Z");
  });
});

describe("toStoredTransaction / toTransactionRow round-trip", () => {
  const stored: StoredTransaction = {
    id: "tx-rt" as TransactionId,
    userId: "user-1" as UserId,
    type: "income",
    amount: 5000 as CopAmount,
    categoryId: "transfer" as CategoryId,
    description: "Monthly",
    date: new Date(2026, 2, 1),
    createdAt: new Date(2026, 2, 1, 10, 0, 0),
    updatedAt: new Date(2026, 2, 1, 10, 0, 0),
    deletedAt: null,
  };

  test("toTransactionRow produces correct DB row", () => {
    const row = toTransactionRow(stored);
    expect(row.id).toBe("tx-rt");
    expect(row.userId).toBe("user-1");
    expect(row.type).toBe("income");
    expect(row.amount).toBe(5000);
    expect(row.date).toBe("2026-03-01");
    expect(typeof row.createdAt).toBe("string");
  });

  test("toStoredTransaction reverses toTransactionRow", () => {
    const row = toTransactionRow(stored);
    const roundTripped = toStoredTransaction(row);
    expect(roundTripped.id).toBe(stored.id);
    expect(roundTripped.userId).toBe(stored.userId);
    expect(roundTripped.type).toBe(stored.type);
    expect(roundTripped.amount).toBe(stored.amount);
    expect(roundTripped.categoryId).toBe(stored.categoryId);
    expect(roundTripped.description).toBe(stored.description);
    expect(roundTripped.date.getFullYear()).toBe(stored.date.getFullYear());
    expect(roundTripped.date.getMonth()).toBe(stored.date.getMonth());
    expect(roundTripped.date.getDate()).toBe(stored.date.getDate());
    expect(roundTripped.deletedAt).toBeNull();
  });
});
