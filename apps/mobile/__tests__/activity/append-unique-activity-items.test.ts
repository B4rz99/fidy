import { describe, expect, it } from "vitest";
import { appendUniqueActivityItems } from "@/features/activity/lib/append-unique-activity-items";
import type {
  CategoryId,
  CopAmount,
  FinancialAccountId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

const USER_ID = "user-1" as UserId;

function makeTransactionItem(id: TransactionId) {
  return {
    kind: "transaction" as const,
    id,
    date: new Date("2026-04-19T00:00:00.000Z"),
    updatedAt: new Date("2026-04-19T10:00:00.000Z"),
    transaction: {
      id,
      userId: USER_ID,
      type: "expense" as const,
      amount: 120_000 as CopAmount,
      categoryId: "food" as CategoryId,
      description: "Lunch",
      date: new Date("2026-04-19T00:00:00.000Z"),
      accountId: "fa-checking" as FinancialAccountId,
      accountAttributionState: "confirmed" as const,
      createdAt: new Date("2026-04-19T09:00:00.000Z"),
      updatedAt: new Date("2026-04-19T10:00:00.000Z"),
      deletedAt: null,
      source: "manual" as const,
    },
  };
}

function makeTransferItem(id: TransferId) {
  return {
    kind: "transfer" as const,
    id,
    date: new Date("2026-04-19T00:00:00.000Z"),
    updatedAt: new Date("2026-04-19T11:00:00.000Z"),
    transfer: {
      id,
      userId: USER_ID,
      amount: 450_000 as CopAmount,
      fromSide: { kind: "account" as const, accountId: "fa-checking" as FinancialAccountId },
      toSide: { kind: "account" as const, accountId: "fa-card" as FinancialAccountId },
      description: "",
      date: new Date("2026-04-19T00:00:00.000Z"),
      createdAt: new Date("2026-04-19T09:00:00.000Z"),
      updatedAt: new Date("2026-04-19T11:00:00.000Z"),
      deletedAt: null,
    },
  };
}

describe("appendUniqueActivityItems", () => {
  it("keeps existing items and only appends unseen activity identities", () => {
    const current = [
      makeTransactionItem("tx-1" as TransactionId),
      makeTransferItem("tr-1" as TransferId),
    ];
    const next = [
      makeTransferItem("tr-1" as TransferId),
      makeTransactionItem("tx-2" as TransactionId),
      makeTransferItem("tr-2" as TransferId),
    ];

    expect(appendUniqueActivityItems(current, next).map((item) => `${item.kind}:${item.id}`)).toEqual(
      ["transaction:tx-1", "transfer:tr-1", "transaction:tx-2", "transfer:tr-2"]
    );
  });
});
