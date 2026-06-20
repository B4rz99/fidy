import { describe, expect, test } from "vitest";
import { toStoredTransaction } from "@/features/transactions/lib/build-transaction";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

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
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "confirmed",
      createdAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      voidedAt: null,
    };
    const result = toStoredTransaction(row);
    expect(result.description).toBe("");
  });

  test("handles non-null voidedAt by converting to Date", () => {
    const row = {
      id: "tx-da" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 500 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Test",
      date: "2026-03-01" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "confirmed",
      createdAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      voidedAt: "2026-03-02T10:00:00.000Z" as IsoDateTime,
    };
    const result = toStoredTransaction(row);
    expect(result.voidedAt).toBeInstanceOf(Date);
    expect(result.voidedAt?.toISOString()).toBe("2026-03-02T10:00:00.000Z");
  });

  test("preserves custom category IDs when hydrating rows", () => {
    const row = {
      id: "tx-custom-category" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 500 as CopAmount,
      categoryId: "ucat-desserts" as CategoryId,
      description: "Cupcake",
      date: "2026-03-01" as IsoDate,
      accountId: "fa-default-user-1" as FinancialAccountId,
      accountAttributionState: "confirmed",
      createdAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-01T10:00:00.000Z" as IsoDateTime,
      voidedAt: null,
    };

    const result = toStoredTransaction(row);

    expect(result.categoryId).toBe("ucat-desserts");
  });
  test("preserves non-default ownership metadata through row hydration", () => {
    const row = {
      id: "tx-captured" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 8200 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Captured lunch",
      date: "2026-03-03" as IsoDate,
      accountId: "fa-credit-card" as FinancialAccountId,
      accountAttributionState: "unresolved",
      supersededAt: "2026-03-04T10:00:00.000Z" as IsoDateTime,
      createdAt: "2026-03-03T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-03T12:00:00.000Z" as IsoDateTime,
      voidedAt: null,
      source: "email_capture",
    };

    const storedTransaction = toStoredTransaction(row);

    expect(storedTransaction.accountId).toBe("fa-credit-card");
    expect(storedTransaction.accountAttributionState).toBe("unresolved");
    expect(storedTransaction.supersededAt?.toISOString()).toBe("2026-03-04T10:00:00.000Z");
    expect(storedTransaction.source).toBe("email_capture");
  });

  test("rejects missing account attribution state", () => {
    const row = {
      id: "tx-legacy-source" as TransactionId,
      userId: "user-1" as UserId,
      type: "expense",
      amount: 8200 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Captured lunch",
      date: "2026-03-03" as IsoDate,
      accountId: "fa-credit-card" as FinancialAccountId,
      accountAttributionState: undefined as never,
      supersededAt: null,
      createdAt: "2026-03-03T10:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-03-03T12:00:00.000Z" as IsoDateTime,
      voidedAt: null,
      source: "email_gmail",
    };

    expect(() => toStoredTransaction(row)).toThrow("Unsupported account attribution state");
  });
});
